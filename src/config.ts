import * as path from "path";

export const BASE_URL = "https://publico.oefa.gob.pe/repdig";

export const CONSULTA_PATH = "/consulta/consultaTfa.xhtml";

export const CONSULTA_URL = `${BASE_URL}${CONSULTA_PATH}`;

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export const FORM_ID = "listarDetalleInfraccionRAAForm";

export const FIELDS = {
  form: FORM_ID,
  nroExpediente: `${FORM_ID}:txtNroexp`,
  administrado: `${FORM_ID}:j_idt21`,
  unidadFiscalizable: `${FORM_ID}:j_idt25`,
  sector: `${FORM_ID}:idsector`,
  nroResolucion: `${FORM_ID}:j_idt34`,
  btnBuscar: `${FORM_ID}:btnBuscar`,
  dataTable: `${FORM_ID}:dt`,
  pgLista: `${FORM_ID}:pgLista`,
} as const;

export const ROWS_PER_PAGE = 10;

export const OUTPUT_DIR = path.resolve(process.cwd(), "data");
export const PDF_DIR = path.resolve(process.cwd(), "pdfs");
export const RESOLUTIONS_FILE = path.join(OUTPUT_DIR, "resolutions.json");
export const FAILED_FILE = path.join(OUTPUT_DIR, "failed.json");

export const REQUEST_DELAY_MS = 800;
export const PDF_DELAY_MS = 1200;

export const RETRY = {
  maxAttempts: 6,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 60_000,
} as const;

export const HTTP_TIMEOUT_MS = 120_000;
