import {
  PDF_DELAY_MS,
  REQUEST_DELAY_MS,
  RESOLUTIONS_FILE,
} from "./config";
import { Session } from "./http/session";
import { fetchPage, performSearch } from "./scraper/search";
import { downloadPdf } from "./scraper/pdf";
import {
  ensureDirs,
  pdfExists,
  readResolutions,
  writeResolutions,
} from "./utils/files";
import { FailureLog } from "./utils/failures";
import { logger, sleep } from "./utils/logger";
import { CliOptions, ResolutionRecord } from "./types";

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    startPage: 1,
    downloadPdf: true,
    retryFailed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--start-page":
        opts.startPage = Math.max(1, Number(next()) || 1);
        break;
      case "--max-pages":
        opts.maxPages = Number(next()) || undefined;
        break;
      case "--limit":
        opts.limit = Number(next()) || undefined;
        break;
      case "--no-pdf":
        opts.downloadPdf = false;
        break;
      case "--retry-failed":
        opts.retryFailed = true;
        break;
      default:
        if (arg.startsWith("--")) logger.warn(`Flag desconocido: ${arg}`);
    }
  }
  return opts;
}

class ResolutionStore {
  private records: ResolutionRecord[];
  private index: Map<string, number>;

  constructor() {
    this.records = readResolutions();
    this.index = new Map(
      this.records.map((r, i) => [r.uuid || `${r.page}:${r.rowIndex}`, i])
    );
  }

  upsert(record: ResolutionRecord): ResolutionRecord {
    const key = record.uuid || `${record.page}:${record.rowIndex}`;
    const existing = this.index.get(key);
    if (existing !== undefined) {
      this.records[existing] = { ...this.records[existing], ...record };
      return this.records[existing];
    }
    this.index.set(key, this.records.length);
    this.records.push(record);
    return record;
  }

  get(uuid: string): ResolutionRecord | undefined {
    const i = this.index.get(uuid);
    return i === undefined ? undefined : this.records[i];
  }

  flush(): void {
    writeResolutions(this.records);
  }
}

async function tryDownload(
  session: Session,
  record: ResolutionRecord,
  store: ResolutionStore,
  failures: FailureLog
): Promise<void> {
  if (record.downloaded && record.pdfFileName && pdfExists(record.pdfFileName)) {
    logger.info(`PDF ya descargado, se omite: ${record.pdfFileName}`);
    return;
  }
  try {
    const outcome = await downloadPdf(session, record);
    record.pdfFileName = outcome.fileName;
    record.downloaded = true;
    store.upsert(record);
    failures.remove(record.uuid);
    if (!outcome.skipped) await sleep(PDF_DELAY_MS);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Fallo definitivo al descargar ${record.numeroResolucion}: ${reason}`);
    record.downloaded = false;
    store.upsert(record);
    failures.add(record, reason, 0);
  }
}

async function runFullScrape(session: Session, opts: CliOptions): Promise<void> {
  const store = new ResolutionStore();
  const failures = new FailureLog();

  const search = await performSearch(session);
  if (search.totalPages === 0) {
    logger.warn(
      "El servidor devolvio 0 registros. Suele ser una condicion temporal del " +
        "portal del OEFA (el navegador puede mostrar 0 hasta que el backend se " +
        "restablece). Espera unos minutos y vuelve a intentar."
    );
    return;
  }

  const lastPage = opts.maxPages
    ? Math.min(search.totalPages, opts.startPage - 1 + opts.maxPages)
    : search.totalPages;

  let processed = 0;

  for (let page = opts.startPage - 1; page < lastPage; page++) {
    const records =
      page === 0 && search.firstPage.length > 0
        ? search.firstPage
        : await fetchPage(session, page);

    logger.info(
      `Pagina ${page + 1}/${search.totalPages}: ${records.length} registros.`
    );

    for (const record of records) {
      const merged = store.upsert(record);
      store.flush();

      if (opts.downloadPdf) {
        await tryDownload(session, merged, store, failures);
      }

      processed++;
      if (opts.limit && processed >= opts.limit) {
        logger.info(`Limite alcanzado (${opts.limit} registros). Deteniendo.`);
        store.flush();
        return;
      }
    }

    store.flush();
    if (page + 1 < lastPage) await sleep(REQUEST_DELAY_MS);
  }

  store.flush();
  logger.info(`Scraping completo. Metadata en ${RESOLUTIONS_FILE}.`);
}

async function runRetryFailed(session: Session): Promise<void> {
  const store = new ResolutionStore();
  const failures = new FailureLog();
  const pending = [...failures.all()];

  if (pending.length === 0) {
    logger.info("No hay descargas fallidas por reintentar.");
    return;
  }

  logger.info(`Reintentando ${pending.length} descargas fallidas...`);
  await performSearch(session);

  const byPage = new Map<number, typeof pending>();
  for (const item of pending) {
    const list = byPage.get(item.page) ?? [];
    list.push(item);
    byPage.set(item.page, list);
  }

  for (const [page, items] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    await fetchPage(session, page);
    for (const item of items) {
      const record: ResolutionRecord =
        store.get(item.uuid) ?? {
          nro: "",
          numeroExpediente: "",
          administrado: "",
          unidadFiscalizable: "",
          sector: "",
          numeroResolucion: item.numeroResolucion,
          uuid: item.uuid,
          page: item.page,
          rowIndex: item.rowIndex,
        };
      await tryDownload(session, record, store, failures);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  store.flush();
  logger.info("Reintento de fallidas finalizado.");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  ensureDirs();

  const session = new Session();
  await session.init();

  if (opts.retryFailed) {
    await runRetryFailed(session);
  } else {
    await runFullScrape(session, opts);
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
