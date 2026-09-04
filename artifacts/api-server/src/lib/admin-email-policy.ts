// admin-email-policy.ts
// Task 1.5 guardrail: block personal-email domains for newly-invited admin
// accounts (CMMC L1 blueprint, Tier 1).
//
// Config-driven: the deny-list defaults to a common set of personal email
// providers, and is overridable via the BLOCKED_ADMIN_EMAIL_DOMAINS env var
// (comma-separated domains) so an operator can adjust the policy per
// deployment without a code change or database migration.
//
// NOTE ON SCOPE: this repo has no generic per-org settings column today
// (see lib/db/src/schema/organizations.ts), and drizzle-kit push is a manual
// step in this project (see lib/db/package.json), not something this session
// could safely run against production. A true org-configurable UI (one
// allow/block list per tenant, editable in Settings) would need a schema
// migration a human runs deliberately. This env-var-driven version is the
// safe subset of Task 1.5 that ships without a migration.
//
// This guardrail only applies to NEW admin invitations going forward and
// intentionally does not touch any existing account.
const DEFAULT_BLOCKED_ADMIN_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com", "aol.com"];

export function getBlockedAdminEmailDomains(): string[] {
  const fromEnv = process.env.BLOCKED_ADMIN_EMAIL_DOMAINS;
  if (!fromEnv || !fromEnv.trim()) {
    return DEFAULT_BLOCKED_ADMIN_EMAIL_DOMAINS;
  }
  return fromEnv.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function isBlockedAdminEmailDomain(email: string): boolean {
  const domain = (email ?? "").split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return getBlockedAdminEmailDomains().includes(domain);
}
