import { FIELDS, ROWS_PER_PAGE } from "../config";

const VIEWSTATE_HTML_RE =
  /id="j_id1:javax\.faces\.ViewState:0"\s+value="([^"]+)"/;
const VIEWSTATE_XML_RE =
  /<update id="[^"]*javax\.faces\.ViewState[^"]*"><!\[CDATA\[([\s\S]*?)\]\]><\/update>/;

export function extractViewStateFromHtml(html: string): string | null {
  const match = html.match(VIEWSTATE_HTML_RE);
  return match ? match[1] : null;
}

export function extractViewStateFromPartial(xml: string): string | null {
  const match = xml.match(VIEWSTATE_XML_RE);
  return match ? match[1] : null;
}

function baseFormFields(): Record<string, string> {
  return {
    [FIELDS.form]: FIELDS.form,
    [FIELDS.nroExpediente]: "",
    [FIELDS.administrado]: "",
    [FIELDS.unidadFiscalizable]: "",
    [FIELDS.sector]: "",
    [FIELDS.nroResolucion]: "",
  };
}

export function buildSearchPayload(viewState: string): URLSearchParams {
  const params = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": FIELDS.btnBuscar,
    "javax.faces.partial.execute": FIELDS.btnBuscar,
    "javax.faces.partial.render": `${FIELDS.pgLista} ${FIELDS.nroExpediente}`,
    [FIELDS.btnBuscar]: FIELDS.btnBuscar,
    ...baseFormFields(),
    "javax.faces.ViewState": viewState,
  });
  return params;
}

export function buildPaginationPayload(
  page: number,
  viewState: string
): URLSearchParams {
  const params = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": FIELDS.dataTable,
    "javax.faces.partial.execute": FIELDS.dataTable,
    "javax.faces.partial.render": FIELDS.dataTable,
    [FIELDS.dataTable]: FIELDS.dataTable,
    [`${FIELDS.dataTable}_pagination`]: "true",
    [`${FIELDS.dataTable}_first`]: String(page * ROWS_PER_PAGE),
    [`${FIELDS.dataTable}_rows`]: String(ROWS_PER_PAGE),
    [`${FIELDS.dataTable}_encodeFeature`]: "true",
    ...baseFormFields(),
    "javax.faces.ViewState": viewState,
  });
  return params;
}

export function buildDownloadPayload(
  rowIndex: number,
  uuid: string,
  viewState: string
): URLSearchParams {
  const commandId = `${FIELDS.dataTable}:${rowIndex}:j_idt63`;
  const params = new URLSearchParams({
    ...baseFormFields(),
    [commandId]: commandId,
    param_uuid: uuid,
    "javax.faces.ViewState": viewState,
  });
  return params;
}
