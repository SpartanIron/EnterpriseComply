import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

// ─── Role Definitions ────────────────────────────────────────────────────────
export type AppRole =
| "super_admin"
| "org_admin"
| "compliance_manager"
| "analyst"
| "auditor"
| "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  compliance_manager: "Compliance Manager",
  analyst: "Analyst",
  auditor: "Auditor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full platform access including Owner Control Panel.",
  org_admin: "Manage users, settings, billing and all GRC features for this org.",
  compliance_manager: "Full GRC access: controls, risks, evidence, reports. No user management.",
  analyst: "Contribute evidence, controls, risks and POA&M items. Read-only settings.",
  auditor: "Read-only access to Auditor Portal, controls, and evidence only.",
  viewer: "Dashboard and compliance reports only. No editing.",
};

export const ROLE_ORDER: AppRole[] = [
  "super_admin", "org_admin", "compliance_manager", "analyst", "auditor", "viewer"
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
  "/people":            "org_admin",
  "/access-reviews":    "org_admin",
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
  "/settings":          "org_admin",
  "/audit-log":         "org_admin",
  "/docs":              "viewer",
  "/super-admin":       "super_admin",
  "/report":            "viewer",
};

export function roleIndex(role: AppRole): number {
  return ROLE_ORDER.indexOf(role);
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

const SUPER_ADMIN_EMAILS = [
  "annankwekujude@gmail.com",
  "admin@colorcodesolutions.com",
  "ops@colorcodesolutions.com",
];

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const userEmail = session.data?.user?.email ?? "";
  const isLoaded = !session.isPending;

  const { data: memberData, isLoading: memberLoading } = useQuery<{ role: AppRole | null }>({
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

    if (userEmail && (SUPER_ADMIN_EMAILS.includes(userEmail) || userEmail.endsWith("@colorcodesolutions.com"))) {
      setRole("super_admin");
      setResolved(true);
      return;
    }

    if (!session.data?.user) {
      setRole("viewer");
      setResolved(true);
      return;
    }

    if (memberLoading) return;

    setRole(memberData?.role ?? "analyst");
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
