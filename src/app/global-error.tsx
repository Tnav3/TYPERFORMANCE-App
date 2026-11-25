"use client";
export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ background: "#0b0b0b", color: "#fff", fontFamily: "system-ui", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 900 }}>The app hit a snag</p>
          <p style={{ color: "#aaa" }}>It may have just updated. Reload to get the latest version.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, minHeight: 48, padding: "0 20px", borderRadius: 12, background: "#D2141E", color: "#fff", fontWeight: 800, border: 0 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
