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
    ],
  },
  {
    section: "Evidence",
    items: [
      { path: "/integrations", label: "Integrations", icon: IntegrationsIcon },
      { path: "/evidence", label: "Evidence Vault", icon: EvidenceIcon },
    ],
  },
  {
    section: "Workforce",
    items: [
      { path: "/policies", label: "Policies", icon: PoliciesIcon },
      { path: "/people", label: "People", icon: PeopleIcon },
      { path: "/vendors", label: "Vendors", icon: VendorsIcon },
    ],
  },
  {
    section: "Federal",
    items: [
      { path: "/poam", label: "POA&M", icon: PoamIcon },
    ],
  },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me"), { credentials: "include" });
      return res.json();
    },
  });

  const org = orgData?.org;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={`${BASE_PATH}/logo.svg`} className="h-7 w-7 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">ColorComply</p>
              {org && <p className="text-xs text-slate-400 truncate">{org.name}</p>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {NAV.map(({ section, items }) => (
            <div key={section} className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">{section}</p>
              {items.map(({ path, label, icon: Icon }) => {
                const active = location === path || location.startsWith(path + "/");
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon active={active} />
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => navigate("/settings")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${location === "/settings" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <SettingsIcon active={location === "/settings"} />
            Settings
          </button>
          <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1">
            {user?.imageUrl
              ? <img src={user.imageUrl} className="h-7 w-7 rounded-full flex-shrink-0" />
              : <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">{user?.firstName?.[0] ?? "U"}</div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
              <button onClick={() => signOut()} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function FrameworksIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function ControlsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function IntegrationsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function EvidenceIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
function PoliciesIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function VendorsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function PoamIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
