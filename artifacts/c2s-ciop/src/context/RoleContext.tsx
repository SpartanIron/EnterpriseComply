import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

// ─── Role Definitions ────────────────────────────────────────────────────────
export type AppRole =
| "super_admin"        // ColorCode Solutions platform owner
| "org_admin"          // Client org administrator
| "compliance_manager" // Power user — all GRC features
| "analyst"            // Day-to-day contributor
| "auditor"            // Read-only, auditor portal only
| "viewer";            // Dashboard + reports only

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

// Ordered from highest to lowest privilege
export const ROLE_ORDER: AppRole[] = [
  "super_admin", "org_admin", "compliance_manager", "analyst", "auditor", "viewer"
];

// ─── Permission Matrix ───────────────────────────────────────────────────────
// Maps each nav section to the minimum role required to see it
export const SECTION_MIN_ROLE: Record<string, AppRole> = {
  Overview:           "viewer",
  Compliance:         "analyst",
  Evidence:           "analyst",
  Workforce:          "analyst",
  "Audit & Sales":    "compliance_manager",
  Federal:            "compliance_manager",
  Vulnerability:      "compliance_manager",
};

// Maps each route to the minimum role required
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

// ─── Role Helpers ────────────────────────────────────────────────────────────
export function roleIndex(role: AppRole): number {
  return ROLE_ORDER.indexOf(role);
}

// Returns true if userRole meets or exceeds the required minimum role
export function hasMinRole(userRole: AppRole, minRole: AppRole): boolean {
  return roleIndex(userRole) <= roleIndex(minRole);
}

// ─── Context ─────────────────────────────────────────────────────────────────
interface RoleContextValue {
  role: AppRole;
  isLoading: boolean;
  can: (minRole: AppRole) => boolean;
  canSeeSection: (section: string) => boolean;
  canVisitRoute: (route: string) => boolean;
}

// Default context while loading: show everything (analyst defaults)
const RoleContext = createContext<RoleContextValue>({
  role: "analyst",
  isLoading: true,
  can: () => true,
  canSeeSection: () => true,
  canVisitRoute: () => true,
});

// Super admin emails (platform owner level)
const SUPER_ADMIN_EMAILS = [
  "annankwekujude@gmail.com",
  "admin@colorcodesolutions.com",
  "ops@colorcodesolutions.com",
];

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  // Fetch role from org membership API
  const { data: memberData, isLoading: memberLoading } = useQuery<{ role: AppRole | null }>({
    queryKey: ["member-role"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me/role"), { credentials: "include" });
      if (!res.ok) return { role: null };
      return res.json();
    },
    enabled: !!isLoaded && !!user,
    staleTime: 60000,
    retry: false,
  });

  // Start as "analyst" — ensures full nav is visible during Clerk load
  const [role, setRole] = useState<AppRole>("analyst");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!isLoaded) return; // Wait for Clerk to initialise

    const email = user?.primaryEmailAddress?.emailAddress ?? "";

    // Platform owner check
    if (email && (SUPER_ADMIN_EMAILS.includes(email) || email.endsWith("@colorcodesolutions.com"))) {
      setRole("super_admin");
      setResolved(true);
      return;
    }

    // Not signed in
    if (!user) {
      setRole("viewer");
      setResolved(true);
      return;
    }

    // Wait for member role API response
    if (memberLoading) return;

    setRole(memberData?.role ?? "analyst");
    setResolved(true);
  }, [isLoaded, user, memberData, memberLoading]);

  // isLoading = true while either Clerk or the role API hasn't resolved yet
  const isLoading = !isLoaded || (!resolved && memberLoading);

  const value = useMemo<RoleContextValue>(() => ({
    role,
    isLoading,
    can: (minRole) => {
      if (isLoading) return true; // Show all during load
      return hasMinRole(role, minRole);
    },
    canSeeSection: (section) => {
      if (isLoading) return true; // Show all sections during load
      const min = SECTION_MIN_ROLE[section];
      if (!min) return true;
      return hasMinRole(role, min);
    },
    canVisitRoute: (route) => {
      if (isLoading) return true; // Allow all routes during load
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
