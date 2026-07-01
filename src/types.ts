export interface ResolutionRecord {
  nro: string;
  numeroExpediente: string;
  administrado: string;
  unidadFiscalizable: string;
  sector: string;
  numeroResolucion: string;
  uuid: string;
  page: number;
  rowIndex: number;
  pdfFileName?: string;
  downloaded?: boolean;
}

export interface FailedDownload {
  uuid: string;
  numeroResolucion: string;
  page: number;
  rowIndex: number;
  reason: string;
  attempts: number;
}

export interface CliOptions {
  startPage: number;
  maxPages?: number;
  limit?: number;
  downloadPdf: boolean;
  retryFailed: boolean;
}
