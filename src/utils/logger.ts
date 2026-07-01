type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

function stamp(): string {
  return new Date().toISOString();
}

function emit(level: Level, message: string): void {
  const line = `[${stamp()}] [${level}] ${message}`;
  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg: string) => emit("INFO", msg),
  warn: (msg: string) => emit("WARN", msg),
  error: (msg: string) => emit("ERROR", msg),
  debug: (msg: string) => {
    if (process.env.DEBUG) emit("DEBUG", msg);
  },
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
