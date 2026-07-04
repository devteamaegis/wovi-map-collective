"use client";

import { useEffect } from "react";

// Route-level error boundary (#14). Logs the error to the console (captured by
// the structured-logging sink in production) and offers recovery.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "render_error", error: error.message, digest: error.digest }));
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="serif text-xl text-ink">Something went wrong</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          The error has been logged. You can retry, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="mono mt-2 text-[11px] text-ink-3">ref: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={reset} className="btn btn-primary btn-sm">Try again</button>
          <a href="/reserve" className="btn btn-sm">Go to Reserve</a>
        </div>
      </div>
    </div>
  );
}
