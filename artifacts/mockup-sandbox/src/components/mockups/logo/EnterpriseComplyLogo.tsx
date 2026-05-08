export function EnterpriseComplyLogo() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16" style={{ background: "#f8fafc" }}>

      {/* ── VARIANT A: Full horizontal lockup on white ── */}
      <div style={{ background: "#ffffff", borderRadius: 20, padding: "48px 64px", boxShadow: "0 4px 32px rgba(15,23,42,0.10)", display: "inline-flex", alignItems: "center", gap: 20 }}>
        {/* Icon mark */}
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="72" height="72" rx="18" fill="#2563eb" />
          {/* Shield silhouette */}
          <path d="M36 14L18 21V36C18 46.5 26.1 56.3 36 58.8C45.9 56.3 54 46.5 54 36V21L36 14Z" fill="rgba(255,255,255,0.18)" />
          {/* Checkmark */}
          <path d="M26 36L32.5 43L46 29" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {/* Subtle top line */}
          <path d="M36 14L54 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 14L18 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
            EnterpriseComply
          </span>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 13, letterSpacing: "0.12em", color: "#2563eb", textTransform: "uppercase" }}>
            by ColorCode Solutions
          </span>
        </div>
      </div>

      {/* ── VARIANT B: Dark background ── */}
      <div style={{ background: "#0f172a", borderRadius: 20, padding: "48px 64px", boxShadow: "0 4px 32px rgba(0,0,0,0.35)", display: "inline-flex", alignItems: "center", gap: 20 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="72" height="72" rx="18" fill="#2563eb" />
          <path d="M36 14L18 21V36C18 46.5 26.1 56.3 36 58.8C45.9 56.3 54 46.5 54 36V21L36 14Z" fill="rgba(255,255,255,0.18)" />
          <path d="M26 36L32.5 43L46 29" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 14L54 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 14L18 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: "-0.03em", color: "#ffffff", lineHeight: 1 }}>
            EnterpriseComply
          </span>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 13, letterSpacing: "0.12em", color: "#60a5fa", textTransform: "uppercase" }}>
            by ColorCode Solutions
          </span>
        </div>
      </div>

      {/* ── VARIANT C: Icon only (stacked) ── */}
      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        {/* Icon mark standalone */}
        <div style={{ background: "#ffffff", borderRadius: 20, padding: 24, boxShadow: "0 4px 32px rgba(15,23,42,0.10)" }}>
          <svg width="96" height="96" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="72" height="72" rx="18" fill="#2563eb" />
            <path d="M36 14L18 21V36C18 46.5 26.1 56.3 36 58.8C45.9 56.3 54 46.5 54 36V21L36 14Z" fill="rgba(255,255,255,0.18)" />
            <path d="M26 36L32.5 43L46 29" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M36 14L54 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
            <path d="M36 14L18 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Stacked centered */}
        <div style={{ background: "#ffffff", borderRadius: 20, padding: "32px 48px", boxShadow: "0 4px 32px rgba(15,23,42,0.10)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg width="64" height="64" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="72" height="72" rx="18" fill="#2563eb" />
            <path d="M36 14L18 21V36C18 46.5 26.1 56.3 36 58.8C45.9 56.3 54 46.5 54 36V21L36 14Z" fill="rgba(255,255,255,0.18)" />
            <path d="M26 36L32.5 43L46 29" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M36 14L54 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
            <path d="M36 14L18 21" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", color: "#0f172a", margin: 0 }}>EnterpriseComply</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 11, letterSpacing: "0.12em", color: "#2563eb", textTransform: "uppercase", margin: "4px 0 0" }}>by ColorCode Solutions</p>
          </div>
        </div>
      </div>

    </div>
  );
}
