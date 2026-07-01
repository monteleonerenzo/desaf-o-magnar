import { CONSULTA_URL } from "../config";
import { Session } from "../http/session";
import { buildDownloadPayload } from "../http/jsf";
import { withRetry } from "../utils/retry";
import { sanitizeFileName, savePdf, uniqueFileName } from "../utils/files";
import { ResolutionRecord } from "../types";
import { logger } from "../utils/logger";

const DOWNLOAD_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
};

function targetFileName(record: ResolutionRecord): string {
  const resolucion =
    record.numeroResolucion || record.numeroExpediente || "resolucion";
  const administrado = record.administrado
    ? ` - ${record.administrado.slice(0, 60)}`
    : "";
  return sanitizeFileName(`${resolucion}${administrado}.pdf`);
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

  const buffer = Buffer.from(value.data);
  const fileName = uniqueFileName(targetFileName(record));
  savePdf(fileName, buffer);
  logger.info(`PDF guardado (${(buffer.length / 1024).toFixed(0)} KB): ${fileName}`);
  return { fileName, attempts, skipped: false };
}
