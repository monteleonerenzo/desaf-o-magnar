import * as fs from "fs";
import * as path from "path";
import { OUTPUT_DIR, PDF_DIR } from "../config";
import { ResolutionRecord, FailedDownload } from "../types";
import { RESOLUTIONS_FILE, FAILED_FILE } from "../config";

export function ensureDirs(): void {
  for (const dir of [OUTPUT_DIR, PDF_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 180) || "documento";
}

export function pdfExists(fileName: string): boolean {
  return fs.existsSync(path.join(PDF_DIR, fileName));
}

export function savePdf(fileName: string, data: Buffer): string {
  const target = path.join(PDF_DIR, fileName);
  fs.writeFileSync(target, data);
  return target;
}

export function readResolutions(): ResolutionRecord[] {
  if (!fs.existsSync(RESOLUTIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RESOLUTIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeResolutions(records: ResolutionRecord[]): void {
  fs.writeFileSync(RESOLUTIONS_FILE, JSON.stringify(records, null, 2), "utf-8");
}

export function readFailed(): FailedDownload[] {
  if (!fs.existsSync(FAILED_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FAILED_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeFailed(records: FailedDownload[]): void {
  fs.writeFileSync(FAILED_FILE, JSON.stringify(records, null, 2), "utf-8");
}
