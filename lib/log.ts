// Minimal structured logger (#14 observability). Emits one JSON object per line
// to stdout/stderr — pipe it to any log aggregator (Datadog, Loki, CloudWatch).
// Swap the sink here to forward to an APM without touching call sites.

type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};

// Wrap an async handler so any throw is logged with context and rethrown.
export async function traced<T>(event: string, fn: () => Promise<T>, ctx?: Record<string, unknown>): Promise<T> {
  const start = Date.now();
  try {
    const r = await fn();
    log.info(event, { ...ctx, ms: Date.now() - start, ok: true });
    return r;
  } catch (e) {
    log.error(event, { ...ctx, ms: Date.now() - start, ok: false, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
