import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db,
  organizationsTable,
  orgMembersTable,
  orgFrameworksTable,
  orgControlResultsTable,
  orgIntegrationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class OrgsService {
  async getMe(clerkUserId: string) {
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.clerkUserId, clerkUserId),
    });
    if (!member) return { org: null };

    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, member.orgId),
    });
    return { org, member };
  }

  async createOrg(clerkUserId: string, body: {
    name: string; industry?: string; size?: string; website?: string;
    email?: string; firstName?: string; lastName?: string;
  }) {
    const { name, industry, size, website, email, firstName, lastName } = body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [org] = await db.insert(organizationsTable).values({
      name, slug, industry, size, website, onboardingStep: 2,
    }).returning();

    await db.insert(orgMembersTable).values({
      orgId: org.id, clerkUserId, email: email ?? "",
      firstName, lastName, role: "owner",
    });

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
    const [frameworks, controls, integrations] = await Promise.all([
      db.query.orgFrameworksTable.findMany({
        where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
      }),
      db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) }),
      db.query.orgIntegrationsTable.findMany({ where: eq(orgIntegrationsTable.orgId, orgId) }),
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
      recentActivity: [],
    };
  }
}
