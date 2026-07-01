import { CONSULTA_URL } from "../config";
import { Session } from "../http/session";
import { buildDownloadPayload } from "../http/jsf";
import { withRetry } from "../utils/retry";
import { pdfExists, sanitizeFileName, savePdf } from "../utils/files";
import { ResolutionRecord } from "../types";
import { logger } from "../utils/logger";

const DOWNLOAD_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
};

function filenameFromDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  if (!plain) return null;
  return plain[1].trim();
}

function targetFileName(record: ResolutionRecord, disposition?: string): string {
  const fromHeader = filenameFromDisposition(disposition);
  const base =
    fromHeader ??
    `${record.numeroResolucion || record.numeroExpediente || "documento"}.pdf`;
  const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  const shortUuid = record.uuid.slice(0, 8);
  const dot = withExt.lastIndexOf(".");
  const stem = withExt.slice(0, dot);
  return sanitizeFileName(`${stem} [${shortUuid}].pdf`);
}

export interface DownloadOutcome {
  fileName: string;
  attempts: number;
  skipped: boolean;
}

export async function downloadPdf(
  session: Session,
  record: ResolutionRecord
): Promise<DownloadOutcome> {
  if (!record.uuid) {
    throw new Error("Registro sin uuid; no se puede descargar el PDF.");
  }

  const provisional = targetFileName(record);
  if (pdfExists(provisional)) {
    logger.info(`PDF ya existe, se omite: ${provisional}`);
    return { fileName: provisional, attempts: 0, skipped: true };
  }

  const { value, attempts } = await withRetry(
    `descarga ${record.numeroResolucion || record.uuid}`,
    async () => {
      const payload = buildDownloadPayload(
        record.rowIndex,
        record.uuid,
        session.getViewState()
      );
      const res = await session.client.post<ArrayBuffer>(
        CONSULTA_URL,
        payload.toString(),
        {
          headers: DOWNLOAD_HEADERS,
          responseType: "arraybuffer",
        }
      );
      const contentType = String(res.headers["content-type"] ?? "");
      if (contentType.includes("text/html") || contentType.includes("xml")) {
        throw new Error(`Respuesta no es un PDF (content-type: ${contentType}).`);
      }
      return res;
    }
  );

  const fileName = targetFileName(
    record,
    String(value.headers["content-disposition"] ?? "")
  );
  const buffer = Buffer.from(value.data);
  savePdf(fileName, buffer);
  logger.info(`PDF guardado (${(buffer.length / 1024).toFixed(0)} KB): ${fileName}`);
  return { fileName, attempts, skipped: false };
}
