import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API = `${BASE_PATH}/api`;

type ComponentStatus = "healthy" | "degraded" | "down" | "unknown";
type OverallStatus   = "operational" | "degraded" | "outage";

interface ComponentData {
  key:        string;
  name:       string;
  status:     ComponentStatus;
  uptime90d:  number | null;
  latencyMs:  number | null;
  lastChecked: string | null;
}

interface Incident {
  id:          number;
  component:   string;
  severity:    string;
  description: string;
  startedAt:   string;
  resolvedAt:  string | null;
}

interface StatusResponse {
  overall:      OverallStatus;
  checkedAt:    string;
  components:   ComponentData[];
  incidents:    Incident[];
  dailyBuckets: Record<string, Array<{ date: string; status: ComponentStatus }>>;
}

// ── Status colours ────────────────────────────────────────────────────────────
function overallBg(s: OverallStatus) {
  if (s === "outage")   return "#ef4444";
  if (s === "degraded") return "#f59e0b";
  return "#22c55e";
}
function overallLabel(s: OverallStatus) {
  if (s === "outage")   return "Major Outage";
  if (s === "degraded") return "Degraded Performance";
  return "All Systems Operational";
}
function overallSub(s: OverallStatus) {
  if (s === "outage")   return "One or more systems are experiencing a major outage.";
  if (s === "degraded") return "Some systems are experiencing degraded performance.";
  return "All systems are operating normally with no known issues.";
}

function componentDot(s: ComponentStatus) {
  if (s === "down")     return "#ef4444";
  if (s === "degraded") return "#f59e0b";
  if (s === "healthy")  return "#22c55e";
  return "#94a3b8"; // unknown / no data
}

function dayColor(s: string) {
  if (s === "down")     return "#ef4444";
  if (s === "degraded") return "#f59e0b";
  if (s === "healthy")  return "#22c55e";
  return "#e2e8f0"; // unknown
}

function fmtLatency(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000)   return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtUptime(u: number | null) {
  if (u === null) return "—";
  return `${u.toFixed(2)}%`;
}

// Build a full 90-day bar array (today = rightmost)
function build90DayBars(buckets: Array<{ date: string; status: string }>) {
  const map = Object.fromEntries(buckets.map((b) => [b.date, b.status]));
  const bars: Array<{ date: string; status: string }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    bars.push({ date: key, status: map[key] ?? "unknown" });
  }
  return bars;
}

function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API}/public/status/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
    } catch (err: any) {
      setErrMsg(err?.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", color: "#15803d", fontSize: 14 }}>
        ✓ Check your inbox to confirm your subscription.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        style={{
          flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #e2e8f0",
          borderRadius: 8, fontSize: 14, background: "#fff", color: "#0f172a",
        }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          padding: "8px 18px", background: "#3b82f6", color: "#fff", border: "none",
          borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
          opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        {status === "loading" ? "Subscribing…" : "Subscribe"}
      </button>
      {status === "error" && (
        <p style={{ width: "100%", fontSize: 13, color: "#dc2626", margin: 0 }}>{errMsg}</p>
      )}
    </form>
  );
}

export default function StatusPage() {
  const { data, isLoading, error } = useQuery<StatusResponse>({
    queryKey: ["public-status"],
    queryFn:  async () => {
      const res = await fetch(`${API}/public/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000, // refresh every 60 seconds
    retry: 2,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Nav bar ── */}
      <nav style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "0 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <a href={`${BASE_PATH}/`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={`${BASE_PATH}/logo.svg`} alt="" style={{ height: 28, width: 28 }} />
            <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>EnterpriseComply</span>
          </a>
          <span style={{ color: "#64748b", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            System Status
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* ── Hero status banner ── */}
        {isLoading && (
          <div style={{ background: "#e2e8f0", borderRadius: 12, padding: "28px 32px", marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#334155" }}>Checking status…</div>
          </div>
        )}
        {error && (
          <div style={{ background: "#fee2e2", borderRadius: 12, padding: "28px 32px", marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#991b1b" }}>Unable to load status</div>
            <div style={{ fontSize: 14, color: "#b91c1c", marginTop: 4 }}>Please try again in a moment.</div>
          </div>
        )}
        {data && (
          <div style={{ background: overallBg(data.overall), borderRadius: 12, padding: "28px 32px", marginBottom: 32, color: "#fff" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{overallLabel(data.overall)}</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>{overallSub(data.overall)}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 12 }}>
              Last checked: {fmtDate(data.checkedAt)}
            </div>
          </div>
        )}

        {/* ── Active incidents ── */}
        {data && data.incidents.filter((i) => !i.resolvedAt).length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Active Incidents</h2>
            {data.incidents.filter((i) => !i.resolvedAt).map((inc) => (
              <div key={inc.id} style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 10, padding: "16px 20px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: inc.severity === "critical" ? "#7f1d1d" : inc.severity === "major" ? "#991b1b" : "#b45309",
                    background: inc.severity === "critical" ? "#fee2e2" : inc.severity === "major" ? "#fee2e2" : "#fef3c7",
                    borderRadius: 4, padding: "2px 6px",
                  }}>
                    {inc.severity}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{inc.component.replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{inc.description}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Started: {fmtDate(inc.startedAt)}</div>
              </div>
            ))}
          </section>
        )}

        {/* ── Component health table ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Component Status</h2>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {(data?.components ?? []).map((c, idx) => {
              const bars = build90DayBars(data?.dailyBuckets?.[c.key] ?? []);
              return (
                <div key={c.key} style={{
                  padding: "18px 24px",
                  borderBottom: idx < (data?.components.length ?? 0) - 1 ? "1px solid #f1f5f9" : "none",
                }}>
                  {/* Component name + status dot */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: componentDot(c.status), flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{c.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {c.latencyMs !== null && (
                        <span style={{ fontSize: 12, color: "#64748b" }}>{fmtLatency(c.latencyMs)}</span>
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                        color: c.status === "healthy" ? "#15803d"
                          : c.status === "degraded" ? "#b45309"
                          : c.status === "down" ? "#dc2626"
                          : "#94a3b8",
                      }}>
                        {c.status === "unknown" ? "No data" : c.status}
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 60, textAlign: "right" }}>
                        {fmtUptime(c.uptime90d)} uptime
                      </span>
                    </div>
                  </div>

                  {/* 90-day sparkline */}
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 24, marginTop: 4 }}>
                    {bars.map((b, i) => (
                      <div
                        key={i}
                        title={`${b.date}: ${b.status}`}
                        style={{
                          flex: 1,
                          height: b.status === "unknown" ? 8 : b.status === "degraded" ? 16 : b.status === "down" ? 24 : 24,
                          borderRadius: 2,
                          background: dayColor(b.status),
                          cursor: "default",
                          transition: "height 0.1s",
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>90 days ago</span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>Today</span>
                  </div>
                </div>
              );
            })}

            {/* Loading skeleton */}
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ padding: "18px 24px", borderBottom: i < 5 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ height: 16, width: `${30 + i * 10}%`, background: "#f1f5f9", borderRadius: 4 }} />
                    <div style={{ height: 24, background: "#f8fafc", borderRadius: 2, marginTop: 10 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* ── Recent incidents ── */}
        {data && data.incidents.filter((i) => i.resolvedAt).length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Recent Incidents (30 days)</h2>
            {data.incidents.filter((i) => i.resolvedAt).map((inc) => (
              <div key={inc.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d", background: "#dcfce7", borderRadius: 4, padding: "2px 6px" }}>
                    Resolved
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{inc.component.replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{inc.description}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  {fmtDate(inc.startedAt)} → {fmtDate(inc.resolvedAt)}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── No incidents notice ── */}
        {data && data.incidents.length === 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", color: "#15803d", fontSize: 14, fontWeight: 500 }}>
              ✓ No incidents in the past 30 days.
            </div>
          </section>
        )}

        {/* ── Subscribe to alerts ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Subscribe to alerts</h2>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
            Get notified by email when an incident opens or resolves.
          </p>
          <SubscribeForm />
        </section>

        {/* ── Footer ── */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            EnterpriseComply by ColorCode Solutions — Status checks run every 5 minutes
          </span>
          <a href={`${BASE_PATH}/sign-in`} style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>
            Sign in →
          </a>
        </div>
      </div>
    </div>
  );
}
