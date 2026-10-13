"use client";

import { Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"] });

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className={outfit.className} style={{ display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#ffffff" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#5b616e", marginBottom: 16 }}>Please try again. Your balances and progress are safe.</p>
          <button onClick={reset} style={{ background: "#0052ff", color: "#fff", border: 0, borderRadius: 9999, padding: "12px 24px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
