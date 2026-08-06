"use client";

import { useEffect } from "react";

/**
 * Root error boundary — the last line of defense so a top-level failure shows a
 * message instead of a blank white page. Must render its own <html>/<body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#fafaf9" }}>
        <div style={{ maxWidth: 520, margin: "80px auto", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h1 style={{ fontSize: 18, color: "#1c1917" }}>The app hit an unexpected error</h1>
          <p style={{ fontSize: 14, color: "#57534e" }}>Please try again. If it keeps happening, contact your administrator.</p>
          {error.message && (
            <pre style={{ textAlign: "left", fontSize: 12, background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, padding: 12, overflow: "auto" }}>
              {error.message}
            </pre>
          )}
          {error.digest && <p style={{ fontSize: 11, color: "#a8a29e" }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, background: "#d97706", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
