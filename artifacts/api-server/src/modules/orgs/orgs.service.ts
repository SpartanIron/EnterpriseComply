import { Injectable, ConflictException } from "@nestjs/common";
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
import { eq, and } from "drizzle-orm";
import { sendWelcomeEmail } from "../../lib/email";
import { logger } from "../../lib/logger";

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
orgId: org.id, clerkUserId: userId, email: email ?? "",
firstName, lastName, role: "owner",
});

// Send welcome email â fire and forget, never block org creation
if (email) {
sendWelcomeEmail({ to: email, firstName: firstName ?? undefined, orgName: name })
.catch((err) => logger.error({ err, email }, "[orgs] welcome email failed"));
}

return { org };
}

async updateOrg(orgId: number, body: Record<string, unknown>) {
const allowed = ["name", "industry", "size", "website"] as const;
const updates: Record<string, unknown> = {};
for (const key of allowed) {
if (body[key] !== undefined) updates[key] = body[key];
}
const [org] = await db.update(organizationsTable)
.set(updates as any)
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

async getDashboard(orgId: number, org: typeof organizationsTable.$inferSelect) {
const [frameworks, controls, integrations, policies, people] = await Promise.all([
db.query.orgFrameworksTable.findMany({
where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
}),
db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) }),
db.query.orgIntegrationsTable.findMany({ where: eq(orgIntegrationsTable.orgId, orgId) }),
db.query.orgPoliciesTable.findMany({ where: eq(orgPoliciesTable.orgId, orgId) }),
db.query.orgPeopleTable.findMany({ where: eq(orgPeopleTable.orgId, orgId) }),
]);

const connected = integrations.filter((i) => i.status === "connected");
const passing = controls.filter((c) => c.status === "passing").length;
const failing = controls.filter((c) => c.status === "failing").length;
const total = controls.length;
const overallScore = total > 0 ? Math.round((passing / total) * 100) : 0;

return {
org,
overallScore,
frameworks,
controlSummary: { passing, failing, notTested: total - passing - failing, total },
connectedIntegrations: connected.length,
policiesCount: policies.length,
peopleCount: people.length,
recentActivity: [],
};
}
}
