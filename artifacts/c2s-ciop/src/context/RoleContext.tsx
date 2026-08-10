import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

// ─── Role Definitions ────────────────────────────────────────────────────────
export type AppRole =
| "super_admin"
| "owner"
| "admin"
| "compliance_manager"
| "analyst"
| "auditor"
| "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  admin: "Org Admin",
  compliance_manager: "Compliance Manager",
  analyst: "Analyst",
  auditor: "Auditor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full platform access including Owner Control Panel.",
  owner: "Owns this organisation: users, settings, billing and every GRC feature.",
  admin: "Manage users, settings, billing and all GRC features for this org.",
  compliance_manager: "Full GRC access: controls, risks, evidence, reports. No user management.",
  analyst: "Contribute evidence, controls, risks and POA&M items. Read-only settings.",
  auditor: "Read-only access to Auditor Portal, controls, and evidence only.",
  viewer: "Dashboard and compliance reports only. No editing.",
};

export const ROLE_ORDER: AppRole[] = [
  "super_admin", "owner", "admin", "compliance_manager", "analyst", "auditor", "viewer"
];

export const SECTION_MIN_ROLE: Record<string, AppRole> = {
  Overview:           "viewer",
  Compliance:         "analyst",
  Evidence:           "analyst",
  Workforce:          "analyst",
  "Audit & Sales":    "compliance_manager",
  Federal:            "compliance_manager",
  Vulnerability:      "compliance_manager",
};

export const ROUTE_MIN_ROLE: Record<string, AppRole> = {
  "/dashboard":         "viewer",
  "/frameworks":        "analyst",
  "/controls":          "analyst",
  "/risks":             "analyst",
  "/remediation":       "analyst",
  "/gap-analysis":      "analyst",
  "/assets":            "analyst",
  "/custom-frameworks": "compliance_manager",
  "/integrations":      "analyst",
  "/test-runs":         "analyst",
  "/evidence":          "analyst",
  "/monitoring":        "compliance_manager",
  "/policies":          "analyst",
  "/people":            "admin",
  "/access-reviews":    "admin",
  "/vendors":           "compliance_manager",
  "/audits":            "compliance_manager",
  "/questionnaires":    "compliance_manager",
  "/assessments":       "compliance_manager",
  "/trust-center":      "compliance_manager",
  "/poam":              "compliance_manager",
  "/sprs":              "compliance_manager",
  "/ssp":               "compliance_manager",
  "/stigs":             "compliance_manager",
  "/zero-trust":        "compliance_manager",
  "/system-boundary":   "compliance_manager",
  "/nist-800-171":      "compliance_manager",
  "/fisma-reporting":   "compliance_manager",
  "/conmon":            "compliance_manager",
  "/vuln-management":   "compliance_manager",
  "/control-crosswalk": "compliance_manager",
  "/settings":          "admin",
  "/audit-log":         "admin",
  "/docs":              "viewer",
  "/super-admin":       "super_admin",
  "/report":            "viewer",
};

export function roleIndex(role: AppRole): number {
  const i = ROLE_ORDER.indexOf(role);
  // SECURITY: an unrecognised role must be treated as the LEAST privileged, not the
  // most. indexOf returns -1 for anything outside ROLE_ORDER (org_members.role still
  // defaults to 'member' in the schema), and -1 <= any index, so the previous version
  // silently satisfied every hasMinRole() check for unknown roles.
  return i === -1 ? ROLE_ORDER.length : i;
}

// The API is the only source of truth for a member's role. Its ROLE_HIERARCHY
// (roles.guard.ts) ranks: viewer < auditor < analyst = member < compliance_manager
// < admin < owner < super_admin. Map that vocabulary onto AppRole and fail closed:
// anything unrecognised becomes the LEAST privileged role, never the most.
const ROLE_ALIASES: Record<string, AppRole> = {
  org_admin: "admin",  // client-only legacy name; the API does not rank it
  member: "analyst",   // legacy org_members default; ranked alongside analyst
};

export function normalizeRole(raw: string | null | undefined): AppRole {
  if (!raw) return "viewer";
  const mapped = ROLE_ALIASES[raw] ?? raw;
  return (ROLE_ORDER as string[]).includes(mapped) ? (mapped as AppRole) : "viewer";
}

export function hasMinRole(userRole: AppRole, minRole: AppRole): boolean {
  return roleIndex(userRole) <= roleIndex(minRole);
}

interface RoleContextValue {
  role: AppRole;
  isLoading: boolean;
  can: (minRole: AppRole) => boolean;
  canSeeSection: (section: string) => boolean;
  canVisitRoute: (route: string) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: "analyst",
  isLoading: true,
  can: () => true,
  canSeeSection: () => true,
  canVisitRoute: () => true,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const userEmail = session.data?.user?.email ?? "";
  const isLoaded = !session.isPending;

  const { data: memberData, isLoading: memberLoading } = useQuery<{ role: string | null }>({
    queryKey: ["member-role"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me/role"), { credentials: "include" });
      if (!res.ok) return { role: null };
      return res.json();
    },
    enabled: isLoaded && !!session.data?.user,
    staleTime: 60000,
    retry: false,
  });

  const [role, setRole] = useState<AppRole>("analyst");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    // SECURITY: the role is derived exclusively from the server
    // (GET /api/orgs/me/role -> org_members.role). Never grant an elevated role
    // client-side from the signed-in email address or its domain: every API guard
    // reads org_members, so an email allow-list only produces a UI that claims
    // access the backend will refuse - and an email suffix is not an auth control.

    if (!session.data?.user) {
      setRole("viewer");
      setResolved(true);
      return;
    }

    if (memberLoading) return;

    setRole(normalizeRole(memberData?.role));
    setResolved(true);
  }, [isLoaded, userEmail, session.data?.user, memberData, memberLoading]);

  const isLoading = !resolved;

  const value = useMemo<RoleContextValue>(() => ({
    role,
    isLoading,
    can: (minRole) => {
      if (isLoading) return true;
      return hasMinRole(role, minRole);
    },
    canSeeSection: (section) => {
      if (isLoading) return true;
      const min = SECTION_MIN_ROLE[section];
      if (!min) return true;
      return hasMinRole(role, min);
    },
    canVisitRoute: (route) => {
      if (isLoading) return true;
      const min = ROUTE_MIN_ROLE[route];
      if (!min) return true;
      return hasMinRole(role, min);
    },
  }), [role, isLoading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
