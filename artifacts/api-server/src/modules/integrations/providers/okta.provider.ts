export interface OktaCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "okta";
}

export interface OktaEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "okta";
}

export interface OktaSyncResult {
  controlResults: OktaCheckResult[];
  evidenceItems: OktaEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

async function oktaFetch(domain: string, apiToken: string, path: string): Promise<unknown> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const url = `${base}/api/v1${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `SSWS ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Okta API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function runOktaChecks(domain: string, apiToken: string): Promise<OktaSyncResult> {
  const controlResults: OktaCheckResult[] = [];
  const evidenceItems: OktaEvidenceItem[] = [];

  // Check 1: MFA enrollment - get users and their enrolled factors
  try {
    const users = (await oktaFetch(domain, apiToken, "/users?limit=50&filter=status+eq+%22ACTIVE%22")) as Array<{
      id: string; status: string; profile: { login: string; firstName: string; lastName: string };
      lastLogin?: string; created: string;
    }>;

    let usersWithMfa = 0;
    let inactiveUsers = 0;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    for (const user of users.slice(0, 30)) {
      try {
        const factors = (await oktaFetch(domain, apiToken, `/users/${user.id}/factors`)) as Array<{ factorType: string; status: string }>;
        const activeFactor = factors.find(f => f.status === "ACTIVE");
        if (activeFactor) usersWithMfa++;
      } catch {
        // User may not have factor access
      }
      if (user.lastLogin && new Date(user.lastLogin) < ninetyDaysAgo) {
        inactiveUsers++;
      }
    }

    const checked = Math.min(users.length, 30);
    const coverage = checked > 0 ? Math.round((usersWithMfa / checked) * 100) : 100;
    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: coverage >= 90 ? "passing" : coverage >= 70 ? "warning" : "failing",
      result: `Okta MFA enrollment: ${usersWithMfa}/${checked} active users enrolled (${coverage}%)`,
      integrationKey: "okta",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AI-001",
      title: "Okta MFA Factor Enrollment",
      description: `${usersWithMfa} of ${checked} sampled active users have an MFA factor enrolled (${coverage}%). ${users.length} total active users in Okta.`,
      type: "auto",
      source: "okta",
    });

    // Inactive users check
    controlResults.push({
      ucoControlId: "UCO-AC-003",
      status: inactiveUsers === 0 ? "passing" : inactiveUsers <= 2 ? "warning" : "failing",
      result: `Okta inactive users (>90 days no login): ${inactiveUsers}/${checked} users`,
      integrationKey: "okta",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AC-003",
      title: "Okta Inactive User Audit",
      description: `${inactiveUsers} of ${checked} sampled users have not logged in for over 90 days and may require deprovisioning.`,
      type: "auto",
      source: "okta",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: "warning",
      result: `Okta user MFA check failed: ${String(err)}`,
      integrationKey: "okta",
    });
  }

  // Check 2: Password policy
  try {
    const policies = (await oktaFetch(domain, apiToken, "/policies?type=PASSWORD")) as Array<{
      id: string; name: string; status: string;
      settings?: { password?: { complexity?: { minLength?: number; useUppercase?: boolean; useLowercase?: boolean; useNumber?: boolean; useSymbol?: boolean }; age?: { maxAgeDays?: number } } };
    }>;

    const activePolicy = policies.find(p => p.status === "ACTIVE");
    if (activePolicy) {
      const complexity = activePolicy.settings?.password?.complexity;
      const age = activePolicy.settings?.password?.age;
      const meetsLength = (complexity?.minLength ?? 0) >= 12;
      const hasComplexity = !!(complexity?.useUppercase && complexity?.useLowercase && complexity?.useNumber);
      const hasExpiry = !!(age?.maxAgeDays && age.maxAgeDays <= 90);
      const passing = meetsLength && hasComplexity;
      controlResults.push({
        ucoControlId: "UCO-AC-001",
        status: passing ? "passing" : "failing",
        result: `Okta password policy "${activePolicy.name}": ${complexity?.minLength ?? 0} char min, complexity ${hasComplexity ? "required" : "NOT required"}, expiry ${age?.maxAgeDays ? `${age.maxAgeDays} days` : "none"}`,
        integrationKey: "okta",
      });
      evidenceItems.push({
        ucoControlId: "UCO-AC-001",
        title: "Okta Password Policy",
        description: `Active policy "${activePolicy.name}": minimum ${complexity?.minLength ?? 0} characters, ${hasComplexity ? "complexity required" : "no complexity requirement"}, ${age?.maxAgeDays ? `${age.maxAgeDays}-day` : "no"} expiry.`,
        type: "auto",
        source: "okta",
      });
    }
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "warning",
      result: `Okta password policy check failed: ${String(err)}`,
      integrationKey: "okta",
    });
  }

  // Check 3: MFA enrollment policy (is MFA required)
  try {
    const policies = (await oktaFetch(domain, apiToken, "/policies?type=MFA_ENROLL")) as Array<{
      id: string; name: string; status: string;
      settings?: { factors?: Record<string, { enroll?: { self?: string } }> };
    }>;
    const activePolicy = policies.find(p => p.status === "ACTIVE");
    const mfaRequired = activePolicy?.settings?.factors
      ? Object.values(activePolicy.settings.factors).some(f => f.enroll?.self === "REQUIRED")
      : false;
    controlResults.push({
      ucoControlId: "UCO-AI-003",
      status: mfaRequired ? "passing" : "failing",
      result: `Okta MFA enrollment policy: MFA is ${mfaRequired ? "REQUIRED" : "optional"} for users`,
      integrationKey: "okta",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AI-003",
      title: "Okta MFA Enrollment Policy",
      description: `MFA enrollment is ${mfaRequired ? "required" : "not required"} in the active Okta MFA enrollment policy.`,
      type: "auto",
      source: "okta",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AI-003",
      status: "warning",
      result: `Okta MFA policy check failed: ${String(err)}`,
      integrationKey: "okta",
    });
  }

  const checksPassed = controlResults.filter(r => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
