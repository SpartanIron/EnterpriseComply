import { sql } from "drizzle-orm";
import { Logger } from "@nestjs/common";

/**
 * org-plan.provisioning.ts - declarative plan provisioning.
 *
 * Why this exists
 * ---------------
 * organizations.plan is created with DEFAULT starter, and the only runtime path
 * that can change it is PATCH /api/admin/orgs/:orgId/plan, which is gated on the
 * platform-level super_admin role. Nobody holds that role and nothing inside the
 * product can grant it: the role-management UI omits it deliberately, invites omit
 * it deliberately, and the SSO group sync lists it as a protected role it will
 * never assign. A self-hosted operator therefore has no way to put their own
 * organisation onto the tier they are entitled to.
 *
 * The tempting fix is to grant somebody super_admin from an environment variable.
 * That solves an entitlement problem by handing a human god-mode over every tenant
 * on the platform, which is the wrong trade entirely. Tier is commercial state;
 * platform access is a security boundary. This module only moves the former.
 *
 * Configuration
 * -------------
 *   ORG_PLAN_PROVISIONING="colorcode-solutions=federal,acme-inc=enterprise"
 *
 * Guarantees
 * ----------
 *   Declarative   the variable is the desired state, re-asserted on every boot, so
 *                 a row that drifts is corrected without anyone logging in.
 *   Idempotent    an org already on its configured tier is left untouched and
 *                 nothing is written, so a crash-restart loop cannot flood the
 *                 audit log.
 *   Auditable     every actual change writes an org_audit_log row recording the
 *                 previous and new tier and the fact that provisioning did it.
 *   Least         it can set a tier. It cannot create orgs, create members, change
 *   privilege     roles, or grant platform access. There is no code path from here
 *                 to super_admin.
 *   Fail open     a malformed entry is logged and skipped, and any unexpected error
 *                 is caught by the caller. Provisioning never stops the API from
 *                 booting, because being on the wrong tier is a much smaller
 *                 problem than being offline.
 */

/** Tiers accepted by plan.guard.ts. Anything else is a configuration error. */
export const VALID_PLAN_TIERS = ["starter", "professional", "enterprise", "federal"] as const;

export type PlanTier = (typeof VALID_PLAN_TIERS)[number];

export interface PlanProvisioningEntry {
  slug: string;
  plan: PlanTier;
}

export interface PlanProvisioningResult {
  /** Entries naming an org whose plan already matched. */
  unchanged: string[];
  /** Entries that actually changed a row, formatted as "slug: from -> to". */
  changed: string[];
  /** Entries naming a slug with no matching organisation. */
  missing: string[];
  /** Raw entries rejected by the parser, with the reason. */
  invalid: string[];
}

/**
 * Parse ORG_PLAN_PROVISIONING into entries.
 *
 * Exported so the test suite can exercise the parser without a database. The
 * parser is deliberately strict: a typo silently provisioning the wrong tier is
 * worse than a loud skip, so anything unrecognised is reported rather than guessed.
 */
export function parsePlanProvisioning(raw: string | undefined | null): {
  entries: PlanProvisioningEntry[];
  invalid: string[];
} {
  const entries: PlanProvisioningEntry[] = [];
  const invalid: string[] = [];
  if (!raw || !raw.trim()) return { entries, invalid };

  const seen = new Set<string>();

  for (const chunk of raw.split(",")) {
    const item = chunk.trim();
    if (!item) continue;

    const eq = item.indexOf("=");
    if (eq === -1) {
      invalid.push(`${item} (expected slug=tier)`);
      continue;
    }

    const slug = item.slice(0, eq).trim().toLowerCase();
    const plan = item.slice(eq + 1).trim().toLowerCase();

    if (!slug) {
      invalid.push(`${item} (empty slug)`);
      continue;
    }
    if (!(VALID_PLAN_TIERS as readonly string[]).includes(plan)) {
      invalid.push(`${item} (unknown tier ${plan || "<empty>"})`);
      continue;
    }
    if (seen.has(slug)) {
      invalid.push(`${item} (duplicate slug ${slug})`);
      continue;
    }

    seen.add(slug);
    entries.push({ slug, plan: plan as PlanTier });
  }

  return { entries, invalid };
}

/** drizzle over node-postgres returns a QueryResult; some drivers return the array. */
function rowsOf(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Assert the configured tier on each named organisation.
 *
 * Statements are issued one at a time because the drizzle sql template uses the
 * extended query protocol, which rejects multi-statement strings.
 */
export async function applyPlanProvisioning(
  db: any,
  raw: string | undefined | null,
  logger: Logger,
): Promise<PlanProvisioningResult> {
  const result: PlanProvisioningResult = {
    unchanged: [],
    changed: [],
    missing: [],
    invalid: [],
  };

  const { entries, invalid } = parsePlanProvisioning(raw);
  result.invalid = invalid;

  for (const bad of invalid) {
    logger.warn(`ORG_PLAN_PROVISIONING entry skipped: ${bad}`);
  }
  if (entries.length === 0) return result;

  for (const entry of entries) {
    // Read first so the write can be skipped when nothing would change. That keeps
    // this idempotent and keeps the audit log free of no-op churn on every restart.
    const found = rowsOf(
      await db.execute(
        sql`SELECT id, plan FROM organizations WHERE LOWER(slug) = ${entry.slug} LIMIT 1`,
      ),
    );

    if (found.length === 0) {
      result.missing.push(entry.slug);
      logger.warn(
        `ORG_PLAN_PROVISIONING names slug "${entry.slug}", which matches no organisation - skipped`,
      );
      continue;
    }

    const orgId = Number(found[0].id);
    const currentPlan = String(found[0].plan ?? "starter");

    if (currentPlan === entry.plan) {
      result.unchanged.push(entry.slug);
      continue;
    }

    await db.execute(
      sql`UPDATE organizations SET plan = ${entry.plan}, updated_at = NOW() WHERE id = ${orgId}`,
    );

    // Audit the change. A tier change alters what the tenant can reach, so it is
    // exactly the kind of event an access review expects to find a record of. The
    // insert is written directly rather than through writeAuditLog() so that this
    // module stays importable by the boot path without pulling in the request-scoped
    // helpers, and so a failure here cannot mask the provisioning result.
    try {
      await db.execute(sql`
        INSERT INTO org_audit_log (org_id, action, resource, resource_id, details, actor_id, actor_email)
        VALUES (
          ${orgId},
          ${"org.plan.provisioned"},
          ${"organization"},
          ${String(orgId)},
          ${JSON.stringify({ slug: entry.slug, from: currentPlan, to: entry.plan, source: "ORG_PLAN_PROVISIONING" })}::jsonb,
          ${"system:provisioning"},
          ${"system:provisioning"}
        )
      `);
    } catch (err) {
      logger.error(
        `Plan change for "${entry.slug}" applied but the audit entry failed: ` +
          ((err as any)?.message ?? String(err)),
      );
    }

    result.changed.push(`${entry.slug}: ${currentPlan} -> ${entry.plan}`);
    logger.log(`Provisioned "${entry.slug}" from ${currentPlan} to ${entry.plan}`);
  }

  return result;
}
