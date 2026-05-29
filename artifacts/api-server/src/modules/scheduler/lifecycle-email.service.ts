import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { db, organizationsTable, orgMembersTable, emailDripLogTable } from "@workspace/db";
import { eq, and, lte, gt, isNotNull } from "drizzle-orm";
import {
  sendOnboardingDripEmail,
  sendTrialExpiryEmail,
  sendTrialExpiredEmail,
} from "../../lib/email";

@Injectable()
export class LifecycleEmailService {
  private readonly logger = new Logger(LifecycleEmailService.name);

  // ── Onboarding drip sweep — daily at 09:00 UTC ──────────────────────
  @Cron("0 9 * * *")
  async runOnboardingDripSweep(): Promise<void> {
    this.logger.log("[scheduler] runOnboardingDripSweep start");

    // Find users who have drip_pending but haven't received drip_day3 yet
    const pendingDrips = await db
      .select()
      .from(emailDripLogTable)
      .where(eq(emailDripLogTable.emailType, "drip_pending"));

    for (const drip of pendingDrips) {
      const meta = drip.meta ? (JSON.parse(drip.meta) as { email: string; firstName?: string; createdAt: string }) : null;
      if (!meta?.email) continue;

      const createdAt = new Date(meta.createdAt);
      const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      const dripDays: Array<3 | 7 | 14> = [3, 7, 14];
      for (const day of dripDays) {
        if (daysSince < day) continue;
        const emailType = `drip_day${day}`;
        const alreadySent = await db
          .select({ id: emailDripLogTable.id })
          .from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, drip.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length > 0) continue;
        try {
          await sendOnboardingDripEmail({ to: meta.email, firstName: meta.firstName, day });
          await db.insert(emailDripLogTable).values({ clerkUserId: drip.clerkUserId, emailType }).onConflictDoNothing();
          this.logger.log(`[scheduler] drip day${day} sent to ${meta.email}`);
        } catch (err) {
          this.logger.error({ err }, `[scheduler] drip day${day} failed for ${meta.email}`);
        }
      }
    }
    this.logger.log("[scheduler] runOnboardingDripSweep done");
  }

  // ── Trial expiry sweep — daily at 10:00 UTC ────────────────────────
  @Cron("0 10 * * *")
  async runTrialExpirySweep(): Promise<void> {
    this.logger.log("[scheduler] runTrialExpirySweep start");

    const now = new Date();
    const orgs = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        clerkOrgId: organizationsTable.clerkOrgId,
        trialEndsAt: organizationsTable.trialEndsAt,
      })
      .from(organizationsTable)
      .where(isNotNull(organizationsTable.trialEndsAt));

    for (const org of orgs) {
      if (!org.trialEndsAt) continue;

      // Find primary owner email
      const [owner] = await db
        .select({ email: orgMembersTable.email, firstName: orgMembersTable.firstName, clerkUserId: orgMembersTable.clerkUserId })
        .from(orgMembersTable)
        .where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.role, "admin")));

      if (!owner?.email) continue;

      const msLeft = org.trialEndsAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      // Already expired
      if (daysLeft <= 0) {
        const emailType = "trial_expired";
        const alreadySent = await db
          .select({ id: emailDripLogTable.id })
          .from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, owner.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length === 0) {
          try {
            await sendTrialExpiredEmail({ to: owner.email, firstName: owner.firstName ?? undefined, orgName: org.name });
            await db.insert(emailDripLogTable).values({ clerkUserId: owner.clerkUserId, orgId: org.id, emailType }).onConflictDoNothing();
            this.logger.log(`[scheduler] trial_expired sent to ${owner.email}`);
          } catch (err) { this.logger.error({ err }, "[scheduler] trial_expired failed"); }
        }
        continue;
      }

      // Warning windows: 7, 3, 1 day
      if ([7, 3, 1].includes(daysLeft)) {
        const emailType = `trial_expiry_${daysLeft}d`;
        const alreadySent = await db
          .select({ id: emailDripLogTable.id })
          .from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, owner.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length === 0) {
          try {
            await sendTrialExpiryEmail({ to: owner.email, firstName: owner.firstName ?? undefined, orgName: org.name, daysLeft, trialEndsAt: org.trialEndsAt });
            await db.insert(emailDripLogTable).values({ clerkUserId: owner.clerkUserId, orgId: org.id, emailType }).onConflictDoNothing();
            this.logger.log(`[scheduler] trial_expiry_${daysLeft}d sent to ${owner.email}`);
          } catch (err) { this.logger.error({ err }, `[scheduler] trial_expiry_${daysLeft}d failed`); }
        }
      }
    }
    this.logger.log("[scheduler] runTrialExpirySweep done");
  }
}
