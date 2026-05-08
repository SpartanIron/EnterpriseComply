export function NavyBlue() {
  return (
    <div className="min-h-screen" style={{ background: "#070e1a", fontFamily: "'Inter', sans-serif" }}>

      {/* Nav */}
      <nav style={{ background: "rgba(7,14,26,0.96)", borderBottom: "1px solid rgba(59,130,246,0.12)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(59,130,246,0.35)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "white", letterSpacing: "-0.01em" }}>EnterpriseComply</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a style={{ fontSize: 12, color: "#64748b", cursor: "pointer" }}>Log In</a>
            <a style={{ fontSize: 12, color: "#64748b", cursor: "pointer" }}>Pricing</a>
            <button style={{ background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", color: "white", fontSize: 12, fontWeight: 600, padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 18px rgba(59,130,246,0.35)" }}>
              Request a Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <section style={{ position: "relative", overflow: "hidden", paddingBottom: 0 }}>

        {/* Background layers */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: [
          "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(14,165,233,0.06) 45%, transparent 70%)",
          "radial-gradient(ellipse 45% 40% at 10% 60%, rgba(29,78,216,0.12) 0%, transparent 60%)",
          "radial-gradient(ellipse 30% 30% at 90% 30%, rgba(14,165,233,0.1) 0%, transparent 55%)",
        ].join(", ") }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

        {/* Left floating card */}
        <div style={{ position: "absolute", left: "3.5%", top: "26%", zIndex: 1, width: 210, borderRadius: 14, padding: 14, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(7,14,26,0.9)", backdropFilter: "blur(16px)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid rgba(59,130,246,0.1)" }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(29,78,216,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 11, lineHeight: 1 }}>UCO Control Status</p>
              <p style={{ color: "#334155", fontSize: 9, marginTop: 2 }}>41 controls monitored</p>
            </div>
          </div>
          {[
            { name: "MFA Enforcement", status: "Passing", color: "#4ade80" },
            { name: "Access Reviews", status: "Passing", color: "#4ade80" },
            { name: "Encryption at Rest", status: "Passing", color: "#4ade80" },
            { name: "Incident Response", status: "Review", color: "#f59e0b" },
          ].map((item) => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(59,130,246,0.06)" }}>
              <span style={{ color: "#94a3b8", fontSize: 10.5 }}>{item.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: item.color, fontSize: 10, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                {item.status}
              </span>
            </div>
          ))}
        </div>

        {/* Right floating card */}
        <div style={{ position: "absolute", right: "3.5%", top: "18%", zIndex: 1, width: 198, borderRadius: 14, padding: 14, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(7,14,26,0.9)", backdropFilter: "blur(16px)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          <p style={{ color: "white", fontWeight: 700, fontSize: 11, marginBottom: 2 }}>Compliance Score</p>
          <p style={{ color: "#334155", fontSize: 9, marginBottom: 10 }}>5 frameworks active - Acme Corp</p>
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", background: "linear-gradient(135deg, #60a5fa, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 10 }}>92%</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { fw: "FedRAMP Mod", pct: 94 },
              { fw: "CMMC L2", pct: 88 },
              { fw: "SOC 2 Type II", pct: 97 },
              { fw: "NIST 800-171", pct: 91 },
            ].map(({ fw, pct }) => (
              <div key={fw}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#334155", fontSize: 10 }}>{fw}</span>
                  <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "rgba(59,130,246,0.12)" }}>
                  <div style={{ height: 4, borderRadius: 4, width: `${pct}%`, background: "linear-gradient(90deg, #1d4ed8, #0ea5e9)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center content */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "72px 32px 0", textAlign: "center", position: "relative" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(29,78,216,0.12)", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", animation: "pulse 2s infinite" }} />
            <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>Federal-First GRC Platform</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(2.8rem, 5.8vw, 4.8rem)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.03em", marginBottom: 28 }}>
            <span style={{ display: "block", color: "white" }}>Federal Compliance.</span>
            <span style={{ display: "block", background: "linear-gradient(135deg, #60a5fa 0%, #38bdf8 50%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              One Control. Every Framework.
            </span>
          </h1>

          {/* Chips */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {["FedRAMP", "CMMC L2", "NIST 800-171", "SOC 2", "ISO 27001", "HIPAA", "+6 more"].map((fw) => (
              <span key={fw} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.22)" }}>{fw}</span>
            ))}
          </div>

          {/* Subtext */}
          <p style={{ fontSize: 18, color: "#64748b", lineHeight: 1.65, maxWidth: 580, margin: "0 auto 36px" }}>
            The only GRC platform built federal-first. Implement one control and satisfy every framework simultaneously.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 56 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", color: "white", fontWeight: 700, fontSize: 14, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 4px 32px rgba(59,130,246,0.45)", letterSpacing: "0.01em" }}>
              Request a Demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "rgba(255,255,255,0.04)", color: "#cbd5e1", fontWeight: 600, fontSize: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
              See the Federal Layer
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Product mockup */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 32px", position: "relative" }}>
          <div style={{ position: "absolute", inset: "-40px 10% 0", background: "radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ borderRadius: "12px 12px 0 0", overflow: "hidden", border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 -8px 80px rgba(59,130,246,0.15), 0 0 0 1px rgba(255,255,255,0.04)" }}>
            {/* Browser chrome */}
            <div style={{ background: "#0d1a2e", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: 10, color: "#475569" }}>app.enterprisecomply.com/dashboard</span>
              </div>
            </div>
            {/* App UI */}
            <div style={{ background: "#0b1423", display: "flex", height: 340 }}>
              {/* Sidebar */}
              <div style={{ width: 140, background: "#0a1220", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "12px 0", flexShrink: 0 }}>
                <div style={{ padding: "0 12px 10px", marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>EnterpriseComply</span>
                </div>
                {["Dashboard", "Frameworks", "Controls", "Risk Register", "Integrations", "Monitoring", "POA&M", "SPRS Score"].map((item, i) => (
                  <div key={item} style={{ padding: "5px 12px", fontSize: 9, color: i === 0 ? "#60a5fa" : "#334155", background: i === 0 ? "rgba(59,130,246,0.1)" : "transparent", borderLeft: i === 0 ? "2px solid #60a5fa" : "2px solid transparent" }}>{item}</div>
                ))}
              </div>
              {/* Main content */}
              <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: "#334155", marginBottom: 2 }}>ACME CORP - LIVE POSTURE</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Compliance Score</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ n: "128", l: "Open Tasks", c: "#3b82f6" }, { n: "23", l: "High Risk", c: "#ef4444" }, { n: "15", l: "Upcoming", c: "#f59e0b" }].map(b => (
                        <div key={b.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: b.c }}>{b.n}</p>
                          <p style={{ fontSize: 7, color: "#334155" }}>{b.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { name: "SOC 2 Type II", tag: "International", open: 28, fail: 1, color: "#3b82f6" },
                    { name: "FedRAMP Moderate", tag: "Federal", open: 12, fail: 4, color: "#8b5cf6" },
                    { name: "ISO 27001", tag: "International", open: 24, fail: 2, color: "#06b6d4" },
                    { name: "CMMC Level 2", tag: "Federal", open: 17, fail: 5, color: "#10b981" },
                  ].map(fw => (
                    <div key={fw.name} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, color: "white" }}>{fw.name}</p>
                          <span style={{ fontSize: 8, color: fw.color, background: `${fw.color}22`, padding: "1px 5px", borderRadius: 3 }}>{fw.tag}</span>
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${fw.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 8, color: fw.color, fontWeight: 700 }}>92</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
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

      {/* Color swatch label */}
      <div style={{ padding: "20px 32px", display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#070e1a","#1d4ed8","#0ea5e9","#60a5fa","#38bdf8"].map(c => (
            <div key={c} title={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#334155" }}>Dark Navy + Electric Blue - Federal Authority</p>
      </div>
    </div>
  );
}
