import { AxiosError } from "axios";
import { RETRY } from "../config";
import { logger, sleep } from "./logger";

export function statusOf(error: unknown): number | undefined {
  const err = error as AxiosError;
  return err?.response?.status;
}

export function isRateLimited(error: unknown): boolean {
  return statusOf(error) === 429;
}

export function isRetriable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 429) return true;
  if (status !== undefined && status >= 500) return true;
  const code = (error as AxiosError)?.code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNABORTED";
}

function retryAfterMs(error: unknown): number | undefined {
  const header = (error as AxiosError)?.response?.headers?.["retry-after"];
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(String(header));
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function backoffMs(attempt: number): number {
  const raw = RETRY.baseDelayMs * Math.pow(RETRY.factor, attempt - 1);
  const capped = Math.min(raw, RETRY.maxDelayMs);
  const jitter = Math.random() * (capped * 0.25);
  return Math.round(capped + jitter);
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts: number = RETRY.maxAttempts
): Promise<RetryResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetriable(error)) break;
      const wait = retryAfterMs(error) ?? backoffMs(attempt);
      const status = statusOf(error);
      const tag = status === 429 ? "429 (rate limited)" : status ?? (error as AxiosError)?.code ?? "error";
      logger.warn(
        `${label}: intento ${attempt}/${maxAttempts} fallo [${tag}]. Reintentando en ${wait} ms.`
      );
      await sleep(wait);
    }
  }
  throw lastError;
}
