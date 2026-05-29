import { Injectable } from "@nestjs/common";
import { Webhook } from "svix";
import { db, organizationsTable, orgMembersTable, emailDripLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendWelcomeEmail, sendOnboardingDripEmail } from "../../lib/email";

// Trial duration: 14 days from org creation
const TRIAL_DAYS = 14;

@Injectable()
export class WebhooksService {

  // ── Verify Svix signature + parse payload ───────────────────────────
  verifyAndParse(rawBody: Buffer, headers: Record<string, string>): unknown {
    const secret = process.env["CLERK_WEBHOOK_SECRET"];
    if (!secret) {
      logger.warn("[webhooks] CLERK_WEBHOOK_SECRET not set — skipping signature verification");
      return JSON.parse(rawBody.toString("utf8"));
    }
    const wh = new Webhook(secret);
    return wh.verify(rawBody, headers) as unknown;
  }

  // ── Handle user.created ─────────────────────────────────────────────
  async handleUserCreated(evt: any): Promise<void> {
    const clerkUserId: string = evt.data?.id;
    const email: string | undefined = evt.data?.email_addresses?.[0]?.email_address;
    const firstName: string | undefined = evt.data?.first_name;

    if (!clerkUserId || !email) {
      logger.warn({ evt }, "[webhooks] user.created missing id or email");
      return;
    }

    logger.info({ clerkUserId, email }, "[webhooks] user.created");

    // Upsert org member record
    await db
      .insert(orgMembersTable)
      .values({ orgId: 0, clerkUserId, email, firstName, role: "member" })
      .onConflictDoNothing();

    // Send welcome email (deduplicated)
    const alreadySent = await db
      .select({ id: emailDripLogTable.id })
      .from(emailDripLogTable)
      .where(and(eq(emailDripLogTable.clerkUserId, clerkUserId), eq(emailDripLogTable.emailType, "welcome")));

    if (alreadySent.length === 0) {
      try {
        await sendWelcomeEmail({ to: email, firstName });
        await db.insert(emailDripLogTable).values({ clerkUserId, emailType: "welcome" }).onConflictDoNothing();
        logger.info({ clerkUserId }, "[webhooks] welcome email sent");
      } catch (err) {
        logger.error({ err, clerkUserId }, "[webhooks] welcome email failed (non-fatal)");
      }
    }

    // Schedule day-3 drip (log drip_day3 without sentAt — scheduler will pick it up)
    // We insert a pending record for drip_day3_pending as signal to scheduler
    await db
      .insert(emailDripLogTable)
      .values({ clerkUserId, emailType: "drip_pending", meta: JSON.stringify({ email, firstName, createdAt: new Date().toISOString() }) })
      .onConflictDoNothing();
  }

  // ── Handle organizationMembership.created ───────────────────────────
  async handleOrgMembershipCreated(evt: any): Promise<void> {
    const clerkOrgId: string = evt.data?.organization?.id;
    const clerkUserId: string = evt.data?.public_user_data?.user_id;
    const email: string | undefined = evt.data?.public_user_data?.identifier;
    const firstName: string | undefined = evt.data?.public_user_data?.first_name;
    const role: string = evt.data?.role || "member";

    if (!clerkOrgId || !clerkUserId) return;

    logger.info({ clerkOrgId, clerkUserId, role }, "[webhooks] organizationMembership.created");

    // Find our org by clerkOrgId
    const [org] = await db
      .select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.clerkOrgId, clerkOrgId));

    if (!org) {
      // Org not yet in our DB — create it with trial
      const orgName = evt.data?.organization?.name || clerkOrgId;
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
      await db.insert(organizationsTable).values({
        clerkOrgId,
        name: orgName,
        slug,
        trialEndsAt,
      });
      logger.info({ clerkOrgId, trialEndsAt }, "[webhooks] org created with trial");
    }

    // Upsert member
    if (email) {
      const orgRow = org || (await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.clerkOrgId, clerkOrgId)))[0];
      if (orgRow) {
        await db
          .insert(orgMembersTable)
          .values({ orgId: orgRow.id, clerkUserId, email, firstName, role })
          .onConflictDoNothing();
      }
    }
  }
}
