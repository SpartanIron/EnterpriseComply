import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { useRole, ROLE_LABELS } from "@/context/RoleContext";
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
      { path: "/remediation", label: "Remediation Board", icon: RemediationIcon },
      { path: "/gap-analysis", label: "AI Gap Analysis", icon: GapIcon },
      { path: "/assets", label: "Asset Inventory", icon: AssetIcon },
      { path: "/custom-frameworks", label: "Custom Frameworks", icon: CustomFwIcon },
    ],
  },
  {
    section: "Evidence",
    items: [
      { path: "/integrations", label: "Integrations", icon: IntegrationsIcon },
      { path: "/test-runs", label: "Test Run History", icon: TestRunIcon },
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
      { path: "/assessments", label: "Client Assessments", icon: AssessmentIcon },
      { path: "/trust-center", label: "Trust Center", icon: TrustIcon },
    ],
  },
  {
    section: "Federal",
    items: [
      { path: "/poam", label: "POA&M", icon: PoamIcon },
      { path: "/sprs", label: "SPRS Score", icon: SprsIcon },
      { path: "/ssp", label: "SSP Generator", icon: SspIcon },
      { path: "/stigs", label: "STIG Findings", icon: StigIcon },
      { path: "/zero-trust", label: "Zero Trust Assessment", icon: ZtaIcon },
      { path: "/system-boundary", label: "System Boundary", icon: BoundaryIcon },
      { path: "/nist-800-171", label: "NIST 800-171 Rev 3", icon: NistIcon },
      { path: "/fisma-reporting", label: "FISMA Reporting", icon: FismaIcon },
      { path: "/conmon", label: "ConMon Program", icon: ConMonIcon },
    ],
  },
  {
    section: "Vulnerability",
    items: [
      { path: "/vuln-management", label: "Vuln Management", icon: VulnIcon },
      { path: "/control-crosswalk", label: "Control Crosswalk", icon: CrosswalkIcon },
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
  const { role, canSeeSection, can } = useRole();
  const qc = useQueryClient();
  const notifRef = useRef<HTMLDivElement>(null);

  const activeSection = getActiveSection(location);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([activeSection]));
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
  const orgId = org?.id;

  const { data: notifData } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["notifications", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/notifications`), { credentials: "include" })).json(),
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(apiUrl(`/orgs/${orgId}/notifications/${id}/read`), { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch(apiUrl(`/orgs/${orgId}/notifications/mark-all-read`), { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const NOTIF_TYPE_STYLES: Record<string, { dot: string; icon: string }> = {
    error:   { dot: "bg-red-500",    icon: "text-red-500" },
    warning: { dot: "bg-amber-400",  icon: "text-amber-500" },
    success: { dot: "bg-green-500",  icon: "text-green-500" },
    info:    { dot: "bg-blue-500",   icon: "text-blue-500" },
  };

  const currentLabel = (() => {
    if (location === "/settings") return "Settings";
    if (location === "/super-admin") return "Owner Control Panel";
  if (location === "/docs") return "Documentation";
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
            <img src={`${BASE_PATH}/logo.svg`} className="h-9 w-9 flex-shrink-0" style={{ filter: "drop-shadow(0 2px 8px rgba(37,99,235,0.4))" }} />
            <div className="min-w-0">
              <p className="font-extrabold text-white text-base truncate leading-tight tracking-tight">Enterprise Comply</p>
              {org && <p className="text-xs truncate leading-tight mt-0.5" style={{ color: "rgba(148,163,184,0.9)" }}>{org.name}</p>}
            </div>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {NAV.map(({ section, items }) => {
            if (!canSeeSection(section)) return null;
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
          <div className="px-2.5 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(100,116,139,0.9)" }}>Account</span>
          </div>
          {[
            { path: "/settings", label: "Settings", Icon: SettingsIcon },
            { path: "/audit-log", label: "Audit Log", Icon: AuditLogIcon },
            { path: "/docs", label: "Documentation", Icon: DocsIcon },
        ...(can("org_admin") ? [{ path: "/role-management", label: "Users & Roles", Icon: UsersRolesIcon }] : []),
        ...(can("super_admin") ? [{ path: "/super-admin", label: "Owner Panel", Icon: SuperAdminIcon }] : []),
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

          {/* Product switcher: C2S Intel */}
          <a
            href="https://www.c2sintel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all mt-2 mb-0.5"
            style={{ background: "rgba(245,179,0,0.08)", border: "1px solid rgba(245,179,0,0.2)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,179,0,0.15)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,179,0,0.08)"; }}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-black text-[10px]" style={{ background: "#F5B300", color: "#1a0f00", letterSpacing: "-0.04em" }}>C2S</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight" style={{ color: "#fde68a" }}>C2S Intel</p>
              <p className="text-[10px] leading-tight" style={{ color: "rgba(253,230,138,0.55)" }}>Business Development</p>
            </div>
            <svg className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(245,179,0,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
          {/* User profile */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1">
            {user?.imageUrl
              ? <img src={user.imageUrl} className="h-7 w-7 rounded-full flex-shrink-0" style={{ outline: "1.5px solid rgba(255,255,255,0.15)" }} />
              : <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{user?.firstName?.[0] ?? "U"}</div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate leading-tight" style={{ color: "#e2e8f0" }}>{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
            <button
                onClick={() => signOut({ redirectUrl: BASE_PATH + "/" })}
                className="text-xs leading-tight transition-colors mt-1"
                style={{ color: "rgba(100,116,139,0.8)" }}
              >
                Sign out
              </button>
          <span style={{fontSize:"10px",fontWeight:700,marginTop:"3px",padding:"1px 7px",borderRadius:"999px",display:"inline-block",background:"rgba(37,99,235,0.18)",color:"#93c5fd"}}>{ROLE_LABELS[role]}</span>
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
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 relative"
                title="Notifications"
              >
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Notifications</p>
                      {unreadCount > 0 && <p className="text-xs text-slate-400">{unreadCount} unread</p>}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">No notifications</div>
                    ) : notifications.map((n: any) => {
                      const style = NOTIF_TYPE_STYLES[n.type] ?? NOTIF_TYPE_STYLES.info;
                      return (
                        <div
                          key={n.id}
                          className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${n.read ? "opacity-60" : ""}`}
                          onClick={() => {
                            if (!n.read) markReadMutation.mutate(n.id);
                            if (n.link) { navigate(n.link); setNotifOpen(false); }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? "bg-slate-200" : style.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${n.read ? "text-slate-500" : "text-slate-900"}`}>{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                              <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
function ZtaIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />;
}
function StigIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />;
}
function RemediationIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />;
}
function GapIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />;
}
function AssetIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />;
}
function AssessmentIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />;
}
function TestRunIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />;
}
function SettingsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
}
function AuditLogIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
}

function DocsIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />;
}
function UsersRolesIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />;
}
function SuperAdminIcon({ active }: { active: boolean }) {
  return <Icon active={active} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />;
}

function BoundaryIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />;
}
function NistIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
}
function FismaIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />;
}
function ConMonIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />;
}
function VulnIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
}
function CrosswalkIcon({ active }: { active: boolean }) {
return <Icon active={active} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />;
}
