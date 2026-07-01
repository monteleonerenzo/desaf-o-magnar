import * as cheerio from "cheerio";
import { FIELDS, ROWS_PER_PAGE } from "../config";
import { ResolutionRecord } from "../types";

const UUID_RE = /param_uuid'?\s*:\s*'([0-9a-fA-F-]{36})'/;

function getUpdateHtml(xml: string, idFragment: string): string | null {
  const re = new RegExp(
    `<update id="[^"]*${idFragment}[^"]*"><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></update>`
  );
  const match = xml.match(re);
  return match ? match[1] : null;
}

export function parseTotalRecords(searchXml: string): number {
  const rowCount = searchXml.match(/rowCount\s*:\s*(\d+)/);
  if (rowCount) return Number(rowCount[1]);
  const registros = searchXml.match(/\((\d+)\s*registros\)/);
  if (registros) return Number(registros[1]);
  return 0;
}

export function totalPages(totalRecords: number): number {
  return Math.ceil(totalRecords / ROWS_PER_PAGE);
}

export function parseRows(partialXml: string, page: number): ResolutionRecord[] {
  const html =
    getUpdateHtml(partialXml, `${FIELDS.dataTable}_data`) ??
    getUpdateHtml(partialXml, "pgLista") ??
    getUpdateHtml(partialXml, ":dt") ??
    partialXml;

  const wrapped = /<table/i.test(html)
    ? html
    : `<table><tbody>${html}</tbody></table>`;
  const $ = cheerio.load(wrapped);
  const records: ResolutionRecord[] = [];

  $("tr[data-ri]").each((_, el) => {
    const $row = $(el);
    const rowIndex = Number($row.attr("data-ri"));
    const cells = $row.find("td");
    if (cells.length < 7) return;

    const text = (i: number) => $(cells[i]).text().replace(/\s+/g, " ").trim();

    const onclick = $row.find("a[onclick]").attr("onclick") ?? "";
    const uuidMatch = onclick.match(UUID_RE);
    const uuid = uuidMatch ? uuidMatch[1] : "";

    records.push({
      nro: text(0),
      numeroExpediente: text(1),
      administrado: text(2),
      unidadFiscalizable: text(3),
      sector: text(4),
      numeroResolucion: text(5),
      uuid,
      page,
      rowIndex,
    });
  });

  return records;
}
