import { FailedDownload, ResolutionRecord } from "../types";
import { readFailed, writeFailed } from "./files";

export class FailureLog {
  private items: FailedDownload[];
  private index: Map<string, number>;

  constructor() {
    this.items = readFailed();
    this.index = new Map(this.items.map((f, i) => [f.uuid, i]));
  }

  all(): FailedDownload[] {
    return this.items;
  }

  add(record: ResolutionRecord, reason: string, attempts: number): void {
    const entry: FailedDownload = {
      uuid: record.uuid,
      numeroResolucion: record.numeroResolucion,
      page: record.page,
      rowIndex: record.rowIndex,
      reason,
      attempts,
    };
    const existing = this.index.get(record.uuid);
    if (existing !== undefined) {
      this.items[existing] = entry;
    } else {
      this.index.set(record.uuid, this.items.length);
      this.items.push(entry);
    }
    this.persist();
  }

  remove(uuid: string): void {
    if (!this.index.has(uuid)) return;
    this.items = this.items.filter((f) => f.uuid !== uuid);
    this.index = new Map(this.items.map((f, i) => [f.uuid, i]));
    this.persist();
  }

  private persist(): void {
    writeFailed(this.items);
  }
}
