export function WhiteIndigo() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>

      {/* Nav */}
      <nav style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #e5e7eb", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #4338ca, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", letterSpacing: "-0.01em" }}>EnterpriseComply</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a style={{ fontSize: 13, color: "#6b7280", cursor: "pointer", fontWeight: 500 }}>Log In</a>
            <a style={{ fontSize: 13, color: "#6b7280", cursor: "pointer", fontWeight: 500 }}>Pricing</a>
            <button style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)", color: "white", fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(99,102,241,0.35)" }}>
              Request a Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Announcement bar */}
      <div style={{ background: "#eef2ff", borderBottom: "1px solid #c7d2fe", padding: "9px 0", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#4338ca", fontWeight: 600 }}>WEBINAR</span>
        <span style={{ fontSize: 12, color: "#4f46e5", marginLeft: 10 }}>CMMC Level 2 Readiness for Defense Contractors</span>
        <span style={{ fontSize: 12, color: "#6366f1", marginLeft: 10, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Register free →</span>
      </div>

      {/* Hero section */}
      <section style={{ position: "relative", overflow: "hidden", background: "#f8faff" }}>

        {/* Very subtle background texture */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 60%)" }} />

        {/* Left floating card */}
        <div style={{ position: "absolute", left: "3.5%", top: "26%", zIndex: 1, width: 214, borderRadius: 14, padding: 16, border: "1px solid #e0e7ff", background: "white", boxShadow: "0 8px 32px rgba(99,102,241,0.1), 0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 12, lineHeight: 1 }}>UCO Control Status</p>
              <p style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>41 controls monitored</p>
            </div>
          </div>
          {[
            { name: "MFA Enforcement", status: "Passing", color: "#16a34a" },
            { name: "Access Reviews", status: "Passing", color: "#16a34a" },
            { name: "Encryption at Rest", status: "Passing", color: "#16a34a" },
            { name: "Incident Response", status: "Review", color: "#d97706" },
          ].map((item) => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f8fafc" }}>
              <span style={{ color: "#475569", fontSize: 11 }}>{item.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: item.color, fontSize: 10.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                {item.status}
              </span>
            </div>
          ))}
        </div>

        {/* Right floating card */}
        <div style={{ position: "absolute", right: "3.5%", top: "18%", zIndex: 1, width: 200, borderRadius: 14, padding: 16, border: "1px solid #e0e7ff", background: "white", boxShadow: "0 8px 32px rgba(99,102,241,0.1), 0 1px 4px rgba(0,0,0,0.04)" }}>
          <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 12, marginBottom: 2 }}>Compliance Score</p>
          <p style={{ color: "#94a3b8", fontSize: 10, marginBottom: 10 }}>5 frameworks - Acme Corp</p>
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", color: "#4338ca", marginBottom: 12 }}>92%</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { fw: "FedRAMP Mod", pct: 94 },
              { fw: "CMMC L2", pct: 88 },
              { fw: "SOC 2 Type II", pct: 97 },
              { fw: "NIST 800-171", pct: 91 },
            ].map(({ fw, pct }) => (
              <div key={fw}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b", fontSize: 10.5 }}>{fw}</span>
                  <span style={{ color: "#4338ca", fontSize: 10.5, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "#e0e7ff" }}>
                  <div style={{ height: 4, borderRadius: 4, width: `${pct}%`, background: "linear-gradient(90deg, #4338ca, #6366f1)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center content */}
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "72px 32px 0", textAlign: "center", position: "relative" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99, border: "1px solid #c7d2fe", background: "#eef2ff", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
            <span style={{ color: "#4338ca", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>Federal-First GRC Platform</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(2.8rem, 5.5vw, 4.6rem)", fontWeight: 900, lineHeight: 1.06, letterSpacing: "-0.03em", marginBottom: 24, color: "#0f172a" }}>
            Federal Compliance.{" "}
            <span style={{ background: "linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              One Control. Every Framework.
            </span>
          </h1>

          {/* Chips */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {["FedRAMP", "CMMC L2", "NIST 800-171", "SOC 2", "ISO 27001", "HIPAA", "+6 more"].map((fw) => (
              <span key={fw} style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 6, background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" }}>{fw}</span>
            ))}
          </div>

          {/* Subtext */}
          <p style={{ fontSize: 18, color: "#64748b", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 36px" }}>
            The only GRC platform built federal-first. Implement one control and satisfy every framework simultaneously.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 52 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 30px", background: "linear-gradient(135deg, #4338ca, #6366f1)", color: "white", fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
              Request a Demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", background: "transparent", color: "#374151", fontWeight: 600, fontSize: 14, borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}>
              See the Federal Layer
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Product mockup */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 32px", position: "relative" }}>
          <div style={{ position: "absolute", inset: "-30px 5% 0", background: "radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ borderRadius: "14px 14px 0 0", overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 -4px 40px rgba(99,102,241,0.1), 0 0 0 1px rgba(99,102,241,0.05)" }}>
            {/* Browser chrome */}
            <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ flex: 1, background: "white", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>app.enterprisecomply.com/dashboard</span>
              </div>
            </div>
            {/* App UI */}
            <div style={{ background: "#f8fafc", display: "flex", height: 320 }}>
              {/* Sidebar */}
              <div style={{ width: 148, background: "#0f172a", padding: "12px 0", flexShrink: 0 }}>
                <div style={{ padding: "0 12px 10px", marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: "linear-gradient(135deg, #4338ca, #6366f1)" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>EnterpriseComply</span>
                </div>
                {["Dashboard", "Frameworks", "Controls", "Risk Register", "Integrations", "Monitoring", "POA&M", "SPRS Score"].map((item, i) => (
                  <div key={item} style={{ padding: "5px 12px", fontSize: 9, color: i === 0 ? "#a5b4fc" : "#334155", background: i === 0 ? "rgba(99,102,241,0.15)" : "transparent", borderLeft: i === 0 ? "2px solid #6366f1" : "2px solid transparent" }}>{item}</div>
                ))}
              </div>
              {/* Main content */}
              <div style={{ flex: 1, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2, fontWeight: 500, letterSpacing: "0.06em" }}>ACME CORP - LIVE POSTURE</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Compliance Score</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ n: "128", l: "Open Tasks", c: "#4338ca" }, { n: "23", l: "High Risk", c: "#ef4444" }, { n: "15", l: "Upcoming", c: "#d97706" }].map(b => (
                        <div key={b.l} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", textAlign: "center" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: b.c }}>{b.n}</p>
                          <p style={{ fontSize: 7, color: "#94a3b8" }}>{b.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { name: "SOC 2 Type II", tag: "International", open: 28, fail: 1, color: "#6366f1" },
                    { name: "FedRAMP Moderate", tag: "Federal", open: 12, fail: 4, color: "#8b5cf6" },
                    { name: "ISO 27001", tag: "International", open: 24, fail: 2, color: "#0891b2" },
                    { name: "CMMC Level 2", tag: "Federal", open: 17, fail: 5, color: "#059669" },
                  ].map(fw => (
                    <div key={fw.name} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, color: "#0f172a" }}>{fw.name}</p>
                          <span style={{ fontSize: 8, color: fw.color, background: `${fw.color}18`, padding: "1px 6px", borderRadius: 3 }}>{fw.tag}</span>
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${fw.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 8, color: fw.color, fontWeight: 700 }}>92</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 8, color: "#64748b" }}>{fw.open} Open</span>
                        <span style={{ fontSize: 8, color: "#ef4444" }}>{fw.fail} Fail</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Palette label */}
      <div style={{ padding: "18px 32px", display: "flex", alignItems: "center", gap: 12, justifyContent: "center", background: "#f8faff", borderTop: "1px solid #e0e7ff" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ffffff","#f8faff","#eef2ff","#4338ca","#6366f1"].map(c => (
            <div key={c} title={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid #e2e8f0" }} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#64748b" }}>Clean White + Deep Indigo - Enterprise authority on light</p>
      </div>
    </div>
  );
}
