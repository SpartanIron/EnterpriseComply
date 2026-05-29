// webhooks.service.ts — BetterAuth user lifecycle service (no svix needed)
import { Injectable } from "@nestjs/common";
import { db, organizationsTable, orgMembersTable, emailDripLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendWelcomeEmail } from "../../lib/email";

const TRIAL_DAYS = 14;

@Injectable()
export class WebhooksService {

  async handleUserCreated(userId: string, email: string, firstName?: string): Promise<void> {
    if (!userId || !email) {
      logger.warn({ userId, email }, "[lifecycle] handleUserCreated missing id or email");
      return;
    }
    logger.info({ userId, email }, "[lifecycle] user created");
    const alreadySent = await db
      .select({ id: emailDripLogTable.id })
      .from(emailDripLogTable)
      .where(and(eq(emailDripLogTable.clerkUserId, userId), eq(emailDripLogTable.emailType, "welcome")));
    if (alreadySent.length === 0) {
      try {
        await sendWelcomeEmail({ to: email, firstName });
        await db.insert(emailDripLogTable).values({ clerkUserId: userId, emailType: "welcome" }).onConflictDoNothing();
        logger.info({ userId }, "[lifecycle] welcome email sent");
      } catch (err) {
        logger.error({ err, userId }, "[lifecycle] welcome email failed (non-fatal)");
      }
    }
    await db
      .insert(emailDripLogTable)
      .values({ clerkUserId: userId, emailType: "drip_pending", meta: JSON.stringify({ email, firstName, createdAt: new Date().toISOString() }) })
      .onConflictDoNothing();
  }

  async handleOrgMemberJoined(userId: string, orgId: number, email?: string, firstName?: string, role = "member"): Promise<void> {
    if (!userId || !orgId) return;
    logger.info({ userId, orgId, role }, "[lifecycle] org member joined");
    if (email) {
      await db
        .insert(orgMembersTable)
        .values({ orgId, clerkUserId: userId, email, firstName, role })
        .onConflictDoNothing();
    }
  }

  async ensureOrgWithTrial(userId: string, orgName: string): Promise<number> {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const [org] = await db
      .insert(organizationsTable)
      .values({ name: orgName, slug, trialEndsAt })
      .returning({ id: organizationsTable.id });
    logger.info({ orgId: org.id, trialEndsAt }, "[lifecycle] org created with trial");
    return org.id;
  }
}
