"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f7f6fb" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#6b6780", marginBottom: 16 }}>Please try again. Your balances and progress are safe.</p>
          <button onClick={reset} style={{ background: "#6d28d9", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
