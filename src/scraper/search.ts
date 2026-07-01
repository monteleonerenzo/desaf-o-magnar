import { CONSULTA_URL } from "../config";
import { Session } from "../http/session";
import {
  buildPaginationPayload,
  buildSearchPayload,
  extractViewStateFromPartial,
} from "../http/jsf";
import { withRetry } from "../utils/retry";
import { ResolutionRecord } from "../types";
import { parseRows, parseTotalRecords, totalPages } from "./parser";
import { logger } from "../utils/logger";

const AJAX_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Faces-Request": "partial/ajax",
  "X-Requested-With": "XMLHttpRequest",
};

export interface SearchResult {
  totalRecords: number;
  totalPages: number;
  firstPage: ResolutionRecord[];
}

export async function performSearch(session: Session): Promise<SearchResult> {
  logger.info("Enviando busqueda (filtros vacios)...");
  const { value: xml } = await withRetry("busqueda", async () => {
    const payload = buildSearchPayload(session.getViewState());
    const res = await session.client.post<string>(CONSULTA_URL, payload.toString(), {
      headers: AJAX_HEADERS,
      responseType: "text",
    });
    return res.data;
  });

  session.setViewState(extractViewStateFromPartial(xml));

  const totalRecords = parseTotalRecords(xml);
  const pages = totalPages(totalRecords);
  const firstPage = parseRows(xml, 0);
  logger.info(`Resultados: ${totalRecords} registros en ${pages} paginas.`);
  return { totalRecords, totalPages: pages, firstPage };
}

export async function fetchPage(
  session: Session,
  page: number
): Promise<ResolutionRecord[]> {
  const { value: xml } = await withRetry(`pagina ${page + 1}`, async () => {
    const payload = buildPaginationPayload(page, session.getViewState());
    const res = await session.client.post<string>(CONSULTA_URL, payload.toString(), {
      headers: AJAX_HEADERS,
      responseType: "text",
    });
    return res.data;
  });

  session.setViewState(extractViewStateFromPartial(xml));
  return parseRows(xml, page);
}
