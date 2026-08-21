import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
db,
organizationsTable,
orgMembersTable,
orgFrameworksTable,
orgControlResultsTable,
orgIntegrationsTable,
orgPoliciesTable,
orgPeopleTable,
} from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";
import { sendWelcomeEmail } from "../../lib/email";
import { logger } from "../../lib/logger";
import { getRateLimitPool } from "../../lib/pg-pool";
import { computePosture } from "../../lib/posture";
import { recordPostureDrift } from "../../lib/posture-drift";

@Injectable()
export class OrgsService {
async getMe(userId: string) {
const member = await db.query.orgMembersTable.findFirst({
where: eq(orgMembersTable.clerkUserId, userId),
});
if (!member) return { org: null };

const org = await db.query.organizationsTable.findFirst({
where: eq(organizationsTable.id, member.orgId),
});
return { org, member };
}

  async getMyRole(userId: string) {
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.clerkUserId, userId),
    });
    if (!member) return { role: null };
    return { role: member.role, orgId: member.orgId };
  }

  async createOrg(userId: string, body: {
name: string; industry?: string; size?: string; website?: string;
email?: string; firstName?: string; lastName?: string;
}) {
const { name, industry, size, website, email, firstName, lastName } = body;
// Resolve the owner identity BEFORE creating the organization so a failure
// cannot leave an org behind whose owner has no usable email address.
const memberEmail =
  (email ?? "").trim() || (await this.resolveUserEmail(userId));
if (!memberEmail) {
  throw new ConflictException(
    "Could not determine the owner email address for this organization. Sign in again and retry.",
  );
}

const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let slug = baseSlug;
let org: typeof organizationsTable.$inferSelect | undefined;
for (let attempt = 0; attempt < 5; attempt++) {
if (attempt > 0) {
const suffix = Math.random().toString(36).slice(2, 6);
slug = `${baseSlug}-${suffix}`;
}
try {
const result = await db.insert(organizationsTable).values({
name, slug, industry, size, website, onboardingStep: 2,
}).returning();
org = result[0];
break;
} catch (err: any) {
if (err?.code === "23505" && err?.constraint?.includes("slug")) {
continue;
}
throw err;
}
}

if (!org) {
throw new ConflictException("Could not generate a unique organization identifier. Please try a slightly different company name.");
}

await db.insert(orgMembersTable).values({
orgId: org.id, clerkUserId: userId, email: memberEmail,
firstName, lastName, role: "owner",
});

// Send welcome email â fire and forget, never block org creation
if (memberEmail) {
sendWelcomeEmail({ to: memberEmail, firstName: firstName ?? undefined, orgName: name })
.catch((err) => logger.error({ err, email }, "[orgs] welcome email failed"));
}

return { org };
}

async updateOrg(orgId: number, body: Record<string, unknown>) {
const allowed = ["name", "industry", "size", "website"] as const;
// FIPS 199 is validated rather than passed through, because a typo here becomes
// the recorded categorisation of a federal system. Only the three levels the
// standard defines are accepted, plus null to clear it.
const FIPS_199_LEVELS = new Set(["low", "moderate", "high"]);
const updates: Record<string, unknown> = {};
for (const key of allowed) {
if (body[key] !== undefined) updates[key] = body[key];
}

if (body.fips199Impact !== undefined) {
const raw = body.fips199Impact;
if (raw === null || raw === "") {
updates.fips199Impact = null;
} else if (typeof raw === "string" && FIPS_199_LEVELS.has(raw.toLowerCase())) {
updates.fips199Impact = raw.toLowerCase();
} else {
throw new ConflictException(
"fips199Impact must be low, moderate or high, or null to clear it.",
);
}
}
const [org] = await db.update(organizationsTable)
.set(updates as any)
.where(eq(organizationsTable.id, orgId))
.returning();
return { org };
}

/** Update audit log retention period for enterprise+ orgs (P1-07).
 *  Called by the dedicated PATCH /orgs/:orgId/audit-retention endpoint which
 *  enforces RequirePlan('enterprise') + RequireRole('owner') before reaching here.
 *  Accepts values between 90 and 3650 days; validation is done in the controller. */
async updateAuditRetention(orgId: number, auditRetentionDays: number) {
  const [org] = await db.update(organizationsTable)
    .set({ auditRetentionDays })
    .where(eq(organizationsTable.id, orgId))
    .returning();
  return { org };
}

async patchOnboarding(orgId: number, step: number, complete?: boolean) {
const [org] = await db.update(organizationsTable)
.set({ onboardingStep: step, onboardingComplete: complete ?? false })
.where(eq(organizationsTable.id, orgId))
.returning();
return { org };
}

  /**
   * Resolve a member's email address from the auth store.
   *
   * Org member rows used to be written with an empty email when the caller did
   * not supply one. A member without an identity is unusable for RBAC and
   * worthless as access-review evidence, and it rendered as a blank row on
   * Users & Roles.
   */
  private async resolveUserEmail(userId: string): Promise<string | null> {
    try {
      const { rows } = await getRateLimitPool().query<{ email: string | null }>(
        'SELECT email FROM "user" WHERE id = $1 LIMIT 1',
        [userId],
      );
      const email = rows[0]?.email?.trim();
      return email ? email : null;
    } catch (err) {
      logger.error(
        { err, userId },
        "[orgs] could not resolve member email from auth store",
      );
      return null;
    }
  }

  async getOrgMembers(orgId: number) {
    const members = await db.query.orgMembersTable.findMany({
      where: eq(orgMembersTable.orgId, orgId),
    });

    // Self-heal rows created before the empty-email guard below existed.
    // Idempotent: only touches rows whose email is missing or blank.
    for (const m of members) {
      if (m.email?.trim()) continue;
      const resolved = await this.resolveUserEmail(m.clerkUserId);
      if (!resolved) continue;
      await db
        .update(orgMembersTable)
        .set({ email: resolved })
        .where(eq(orgMembersTable.id, m.id));
      m.email = resolved;
      logger.info(
        { orgId, memberId: m.id },
        "[orgs] backfilled blank org member email from auth store",
      );
    }

    // Who holds an authenticator. One query joined to org_members rather than one
    // lookup per member: the Security tab needs this for every row, and N+1 on a
    // members list is how a settings page starts timing out for exactly the customers
    // who have the most members. Scoped by org_id, so it reads nothing it should not.
    const enrolled = new Set<string>();
    const enrolledRows: any = await db.execute(sql`
      SELECT t."userId" AS user_id
      FROM two_factor t
      JOIN org_members m ON m.clerk_user_id = t."userId"
      WHERE m.org_id = ${orgId}
    `);
    const enrolledList = Array.isArray(enrolledRows)
      ? enrolledRows
      : (enrolledRows?.rows ?? []);
    for (const row of enrolledList) enrolled.add(String(row.user_id));

    return {
      members: members.map((m) => ({
        id: String(m.id),
        clerkUserId: m.clerkUserId,
        email: m.email,
        firstName: m.firstName ?? undefined,
        lastName: m.lastName ?? undefined,
        role: m.role,
        joinedAt: m.createdAt,
        mfaEnrolled: enrolled.has(m.clerkUserId),
      })),
    };
  }

  async getAllOrgsForAdmin(userId: string) {
    // Verify the caller has super_admin role in at least one org
    const membership = await db.query.orgMembersTable.findFirst({
      where: and(eq(orgMembersTable.clerkUserId, userId), eq(orgMembersTable.role, "super_admin")),
    });
    if (!membership) throw new ForbiddenException("Requires super_admin role");

    const [orgs, allMembers] = await Promise.all([
      db.query.organizationsTable.findMany(),
      db.query.orgMembersTable.findMany(),
    ]);

    const countsByOrg = allMembers.reduce((acc: Record<number, number>, m) => {
      acc[m.orgId] = (acc[m.orgId] ?? 0) + 1;
      return acc;
    }, {});

    return {
      orgs: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        industry: o.industry ?? null,
        size: o.size ?? null,
        website: o.website ?? null,
        onboardingComplete: o.onboardingComplete ?? false,
        memberCount: countsByOrg[o.id] ?? 0,
        createdAt: o.createdAt,
        plan: o.plan ?? "starter",
      })),
    };
  }

async getDashboard(orgId: number, org: typeof organizationsTable.$inferSelect) {
const [frameworks, controls, integrations, policies, people, posture] = await Promise.all([
db.query.orgFrameworksTable.findMany({
where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
}),
db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) }),
db.query.orgIntegrationsTable.findMany({ where: eq(orgIntegrationsTable.orgId, orgId) }),
db.query.orgPoliciesTable.findMany({ where: eq(orgPoliciesTable.orgId, orgId) }),
db.query.orgPeopleTable.findMany({ where: eq(orgPeopleTable.orgId, orgId) }),
// Phase 1b. No longer shadow: this is the answer. Rejection still resolves to
// null and the legacy arithmetic below is still computed, so a failure here
// degrades to the old numbers rather than to an error page. That fallback is
// the reason the legacy block survives the cutover.
computePosture(orgId).catch((err) => {
logger.error({ err, orgId }, "[orgs] posture computation failed, falling back to legacy counts");
return null;
}),
]);

const connected = integrations.filter((i) => i.status === "connected");

// Fallback only. Reached when computePosture threw, which on the measured org
// it never has. Kept deliberately rather than deleted: a dashboard that shows
// slightly wrong numbers during a database hiccup is better than one that shows
// none, and this is the whole of the old arithmetic in one place where it is
// obviously the exception rather than the rule.
const legacyPassing = controls.filter((c) => c.status === "passing").length;
const legacyFailing = controls.filter((c) => c.status === "failing").length;
const legacyTotal = controls.length;

// Records the comparison and returns the blocking divergences. Never throws.
const postureDivergences = posture ? recordPostureDrift(posture) : [];

const controlSummary = posture
? {
passing: posture.counts.passing,
warning: posture.counts.warning,
failing: posture.counts.failing,
notTested: posture.counts.notTested,
assessed: posture.counts.assessed,
total: posture.counts.total,
}
: {
passing: legacyPassing,
warning: 0,
failing: legacyFailing,
notTested: legacyTotal - legacyPassing - legacyFailing,
assessed: legacyPassing + legacyFailing,
total: legacyTotal,
};

return {
org,
overallScore: posture ? posture.scorePercent : legacyTotal > 0 ? Math.round((legacyPassing / legacyTotal) * 100) : 0,
// FISMA scoping depends on this. Reported even when unset, because "nobody has
// categorised this system" is information rather than an absence of it.
fips199: posture
? posture.fips199
: {
impactLevel: null,
source: "unavailable",
note: "Posture computation failed, so the recorded FIPS 199 level could not be read.",
},
frameworks,
controlSummary,
connectedIntegrations: connected.length,
policiesCount: policies.length,
peopleCount: people.length,
recentActivity: [],
/**
* Why the two headline numbers moved, in the response, so the UI can say it
* rather than leaving a reader to conclude their compliance collapsed
* overnight.
*
* On the measured org the score goes 20 to 3 and "not tested" goes 5 to 61.
* Nothing got worse. The denominator changed from "objectives that happen to
* have a result row" to "objectives", and five warnings stopped being
* reported as untested.
*/
scoreBasis: posture
? {
source: "posture-ssot",
schema: posture.schema,
denominator: "all control objectives",
previousDenominator: "control objectives with a stored result row",
objectivesTotal: posture.counts.total,
objectivesAssessed: posture.counts.assessed,
assessedScorePercent: posture.assessedScorePercent,
coveragePercent: posture.coveragePercent,
note:
"Score is passing objectives over all objectives. The assessed-only figure " +
"is reported separately because it is the number this dashboard used to " +
"show as the overall score.",
degraded: false,
}
: {
source: "legacy-fallback",
degraded: true,
note:
"Posture computation failed for this request, so these counts come from the " +
"pre-Phase-1 arithmetic and understate the number of untested objectives.",
},
postureDrift: {
divergenceCount: postureDivergences.length,
},
};
}

  /**
   * Multi-factor policy + real enrolment coverage for the organisation.
   *
   * Coverage is computed from the better-auth two_factor table rather than a
   * cached counter, so it cannot drift away from reality.
   */
  async getMfaPolicy(orgId: number) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });
    if (!org) throw new NotFoundException({ error: "no_org" });

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS members,
        COUNT(t."userId")::int AS enrolled
      FROM org_members m
      LEFT JOIN two_factor t ON t."userId" = m.clerk_user_id
      WHERE m.org_id = ${orgId}
    `);
    const r = (rows.rows as any[])[0] ?? { members: 0, enrolled: 0 };
    const enforcedAt = (org as any).mfaEnforcedAt
      ? new Date((org as any).mfaEnforcedAt)
      : null;
    const graceDays = (org as any).mfaGraceDays ?? 14;

    return {
      enforced: org.mfaEnforced === true,
      enforcedAt: enforcedAt ? enforcedAt.toISOString() : null,
      graceDays,
      graceEndsAt: enforcedAt
        ? new Date(enforcedAt.getTime() + graceDays * 86400000).toISOString()
        : null,
      members: r.members ?? 0,
      enrolled: r.enrolled ?? 0,
      coveragePct:
        (r.members ?? 0) === 0 ? 0 : Math.round(((r.enrolled ?? 0) / r.members) * 100),
      control: "NIST IA-2(1) / CMMC IA.L2-3.5.3 / SOC 2 CC6.1",
    };
  }

  async setMfaPolicy(
    orgId: number,
    actorId: string,
    body: { enforced?: boolean; graceDays?: number },
  ) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });
    if (!org) throw new NotFoundException({ error: "no_org" });

    const enforced = body?.enforced === true;
    const graceDays = Number.isInteger(body?.graceDays)
      ? Math.min(Math.max(body!.graceDays as number, 0), 90)
      : ((org as any).mfaGraceDays ?? 14);

    // Only stamp the clock on an off -> on transition, so re-saving the
    // settings page cannot silently extend an in-flight rollout.
    const turningOn = enforced && org.mfaEnforced !== true;

    await db.execute(sql`
      UPDATE organizations
         SET mfa_enforced = ${enforced},
             mfa_grace_days = ${graceDays},
             mfa_enforced_at = CASE
               WHEN ${turningOn} THEN NOW()
               WHEN ${enforced} THEN mfa_enforced_at
               ELSE NULL
             END
       WHERE id = ${orgId}
    `);

    await writeAuditLog(
      orgId,
      enforced ? "org.mfa_enforcement_enabled" : "org.mfa_enforcement_disabled",
      "organization",
      String(orgId),
      { enforced, graceDays, previous: org.mfaEnforced === true },
      actorId,
    );

    return this.getMfaPolicy(orgId);
  }

}
