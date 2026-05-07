import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import type { ReactNode } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const NAV = [
  {
    section: "Overview",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: DashboardIcon },
    ],
  },
  {
    section: "Compliance",
    items: [
      { path: "/frameworks", label: "Frameworks", icon: FrameworksIcon },
      { path: "/controls", label: "Controls", icon: ControlsIcon },
      { path: "/risks", label: "Risk Register", icon: RiskIcon },
    ],
  },
  {
    section: "Evidence",
    items: [
      { path: "/integrations", label: "Integrations", icon: IntegrationsIcon },
      { path: "/evidence", label: "Evidence Vault", icon: EvidenceIcon },
      { path: "/monitoring", label: "Monitoring", icon: MonitoringIcon },
    ],
  },
  {
    section: "Workforce",
    items: [
      { path: "/policies", label: "Policies", icon: PoliciesIcon },
      { path: "/people", label: "People", icon: PeopleIcon },
      { path: "/access-reviews", label: "Access Reviews", icon: ReviewIcon },
      { path: "/vendors", label: "Vendors", icon: VendorsIcon },
    ],
  },
  {
    section: "Audit & Sales",
    items: [
      { path: "/audits", label: "Auditor Portal", icon: AuditIcon },
      { path: "/questionnaires", label: "Questionnaires", icon: QuestionnaireIcon },
      { path: "/trust-center", label: "Trust Center", icon: TrustIcon },
    ],
  },
  {
    section: "Federal",
    items: [
      { path: "/poam", label: "POA&M", icon: PoamIcon },
      { path: "/sprs", label: "SPRS Score", icon: SprsIcon },
      { path: "/ssp", label: "SSP Generator", icon: SspIcon },
      { path: "/custom-frameworks", label: "Custom Frameworks", icon: CustomFwIcon },
    ],
  },
];

function getActiveSection(location: string): string {
  for (const group of NAV) {
    if (group.items.some((item) => location === item.path || location.startsWith(item.path + "/"))) {
      return group.section;
    }
  }
  return "Overview";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const activeSection = getActiveSection(location);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([activeSection]));

  useEffect(() => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  function toggleSection(section: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me"), { credentials: "include" });
      return res.json();
    },
  });

  const org = orgData?.org;

  const currentLabel = (() => {
    if (location === "/settings") return "Settings";
    if (location === "/audit-log") return "Audit Log";
    for (const group of NAV) {
      for (const item of group.items) {
        if (location === item.path || location.startsWith(item.path + "/")) return item.label;
      }
    }
    return "Dashboard";
  })();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8fafc" }}>
      {/* Sidebar - dark */}
      <aside className="w-64 flex flex-col flex-shrink-0" style={{ background: "#0f172a" }}>
        {/* Logo */}
        <button
          onClick={() => navigate("/dashboard")}
          className="h-16 flex items-center px-5 w-full transition-colors"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate leading-tight tracking-tight">EnterpriseComply</p>
              {org && <p className="text-xs truncate leading-tight mt-0.5" style={{ color: "rgba(148,163,184,0.9)" }}>{org.name}</p>}
            </div>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {NAV.map(({ section, items }) => {
            const isOpen = openSections.has(section);
            const hasActive = items.some(
              (item) => location === item.path || location.startsWith(item.path + "/"),
            );

            return (
              <div key={section}>
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg group transition-colors"
                  style={{
                    color: hasActive && !isOpen ? "#60a5fa" : "rgba(100,116,139,0.9)",
                    background: hasActive && !isOpen ? "rgba(59,130,246,0.12)" : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (!(hasActive && !isOpen)) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!(hasActive && !isOpen)) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.9)";
                    }
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "inherit" }}>
                    {section}
                  </span>
                  <svg
                    className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    style={{ color: "inherit" }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="mt-0.5 mb-1.5 space-y-0.5">
                    {items.map(({ path, label, icon: Icon }) => {
                      const active = location === path || location.startsWith(path + "/");
                      return (
                        <button
                          key={path}
                          onClick={() => navigate(path)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: active ? "#2563eb" : "transparent",
                            color: active ? "#ffffff" : "rgba(148,163,184,0.9)",
                            boxShadow: active ? "0 1px 3px rgba(37,99,235,0.4)" : "none",
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                              (e.currentTarget as HTMLElement).style.color = "#f1f5f9";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.9)";
                            }
                          }}
                        >
                          <Icon active={active} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2.5 pb-3 pt-2 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            { path: "/settings", label: "Settings", Icon: SettingsIcon },
            { path: "/audit-log", label: "Audit Log", Icon: AuditLogIcon },
          ].map(({ path, label, Icon }) => {
            const active = location === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? "#2563eb" : "transparent",
                  color: active ? "#ffffff" : "rgba(148,163,184,0.9)",
                  boxShadow: active ? "0 1px 3px rgba(37,99,235,0.4)" : "none",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLElement).style.color = "#f1f5f9";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.9)";
                  }
                }}
              >
                <Icon active={active} />
                {label}
              </button>
            );
          })}

          {/* User profile */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1">
            {user?.imageUrl
              ? <img src={user.imageUrl} className="h-7 w-7 rounded-full flex-shrink-0" style={{ outline: "1.5px solid rgba(255,255,255,0.15)" }} />
              : <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{user?.firstName?.[0] ?? "U"}</div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate leading-tight" style={{ color: "#e2e8f0" }}>{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
              <button
                onClick={() => signOut()}
                className="text-xs leading-tight transition-colors"
                style={{ color: "rgba(100,116,139,0.8)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.8)"; }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:block">{activeSection}</span>
            <svg className="h-3 w-3 text-slate-300 flex-shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-slate-800 truncate">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {org && (
              <span className="text-xs text-slate-400 font-medium hidden md:block">{org.name}</span>
            )}
            <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600" title="Notifications">
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-slate-100">
              {user?.imageUrl
                ? <img src={user.imageUrl} className="h-full w-full object-cover" />
                : <div className="h-full w-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">{user?.firstName?.[0] ?? "U"}</div>
              }
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}

function Icon({ active, d }: { active: boolean; d: string }) {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0"
      style={{ color: active ? "#ffffff" : "rgba(100,116,139,0.7)" }}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />;
}
function FrameworksIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />;
}
function ControlsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />;
}
function RiskIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
}
function IntegrationsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M13 10V3L4 14h7v7l9-11h-7z" />;
}
function EvidenceIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />;
}
function MonitoringIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />;
}
function PoliciesIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
}
function PeopleIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />;
}
function ReviewIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />;
}
function VendorsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />;
}
function AuditIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />;
}
function QuestionnaireIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
}
function TrustIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
}
function PoamIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />;
}
function SprsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />;
}
function SspIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />;
}
function CustomFwIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />;
}
function SettingsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
}
function AuditLogIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
}
