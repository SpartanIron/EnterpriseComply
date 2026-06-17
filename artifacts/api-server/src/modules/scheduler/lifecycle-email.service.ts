import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  db, organizationsTable, orgMembersTable, emailDripLogTable,
  orgPoliciesTable, orgPolicyAcknowledgmentsTable, orgPeopleTable,
  orgVendorsTable, orgVendorAssessmentsTable,
} from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  sendOnboardingDripEmail,
  sendTrialExpiryEmail,
  sendTrialExpiredEmail,
  sendPolicyAcknowledgmentEmail,
  sendPolicyAckReminderEmail,
  sendVendorAssessmentEmail,
} from "../../lib/email";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class LifecycleEmailService {
  private readonly logger = new Logger(LifecycleEmailService.name);

  constructor(private readonly notificationsSvc: NotificationsService) {}

  // ── Onboarding drip sweep — daily at 09:00 UTC ───────────────────────────
  @Cron("0 9 * * *")
  async runOnboardingDripSweep(): Promise<void> {
    this.logger.log("[scheduler] runOnboardingDripSweep start");
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
        const alreadySent = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, drip.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length > 0) continue;
        try {
          await sendOnboardingDripEmail({ to: meta.email, firstName: meta.firstName, day });
          await db.insert(emailDripLogTable).values({ clerkUserId: drip.clerkUserId, emailType }).onConflictDoNothing();
          this.logger.log(`[scheduler] drip day${day} sent to ${meta.email}`);
        } catch (err) { this.logger.error({ err }, `[scheduler] drip day${day} failed for ${meta.email}`); }
      }
    }
    this.logger.log("[scheduler] runOnboardingDripSweep done");
  }

  // ── Trial expiry sweep — daily at 10:00 UTC ─────────────────────────────
  @Cron("0 10 * * *")
  async runTrialExpirySweep(): Promise<void> {
    this.logger.log("[scheduler] runTrialExpirySweep start");
    const now = new Date();
    const orgs = await db
      .select({ id: organizationsTable.id, name: organizationsTable.name, trialEndsAt: organizationsTable.trialEndsAt })
      .from(organizationsTable)
      .where(isNotNull(organizationsTable.trialEndsAt));

    for (const org of orgs) {
      if (!org.trialEndsAt) continue;
      const [owner] = await db
        .select({ email: orgMembersTable.email, firstName: orgMembersTable.firstName, clerkUserId: orgMembersTable.clerkUserId })
        .from(orgMembersTable)
        .where(and(eq(orgMembersTable.orgId, org.id), eq(orgMembersTable.role, "admin")));
      if (!owner?.email) continue;
      const msLeft = org.trialEndsAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) {
        const emailType = "trial_expired";
        const alreadySent = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, owner.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length === 0) {
          try {
            await sendTrialExpiredEmail({ to: owner.email, firstName: owner.firstName ?? undefined, orgName: org.name });
            await db.insert(emailDripLogTable).values({ clerkUserId: owner.clerkUserId, orgId: org.id, emailType }).onConflictDoNothing();
          } catch (err) { this.logger.error({ err }, "[scheduler] trial_expired failed"); }
        }
        continue;
      }
      if ([7, 3, 1].includes(daysLeft)) {
        const emailType = `trial_expiry_${daysLeft}d`;
        const alreadySent = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
          .where(and(eq(emailDripLogTable.clerkUserId, owner.clerkUserId), eq(emailDripLogTable.emailType, emailType)));
        if (alreadySent.length === 0) {
          try {
            await sendTrialExpiryEmail({ to: owner.email, firstName: owner.firstName ?? undefined, orgName: org.name, daysLeft, trialEndsAt: org.trialEndsAt });
            await db.insert(emailDripLogTable).values({ clerkUserId: owner.clerkUserId, orgId: org.id, emailType }).onConflictDoNothing();
          } catch (err) { this.logger.error({ err }, `[scheduler] trial_expiry_${daysLeft}d failed`); }
        }
      }
    }
    this.logger.log("[scheduler] runTrialExpirySweep done");
  }

  // ── Policy acknowledgment sweep — daily at 08:00 UTC ───────────────────
  @Cron("0 8 * * *")
  async runPolicyAcknowledgmentSweep(): Promise<void> {
    this.logger.log("[scheduler] runPolicyAcknowledgmentSweep start");
    try {
      const policies = await db.query.orgPoliciesTable.findMany({
        where: and(eq(orgPoliciesTable.status, "published"), eq(orgPoliciesTable.requiresAcknowledgment, true)),
      });

      for (const policy of policies) {
        try {
          const people = await db.query.orgPeopleTable.findMany({
            where: and(eq(orgPeopleTable.orgId, policy.orgId), eq(orgPeopleTable.active, true)),
          });
          if (people.length === 0) continue;

          const acks = await db.query.orgPolicyAcknowledgmentsTable.findMany({
            where: eq(orgPolicyAcknowledgmentsTable.policyId, policy.id),
          });
          const ackedPersonIds = new Set(acks.map((a: any) => a.personId));

          const publishedAt = policy.publishedAt ?? policy.createdAt;
          const now = new Date();
          const daysSincePublished = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
          const pendingPeople = people.filter((p: any) => !ackedPersonIds.has(p.id) && p.email);
          if (pendingPeople.length === 0) continue;

          if (daysSincePublished >= 3) {
            await this.notificationsSvc.notifyPolicyAckOverdue(policy.orgId, policy.title, pendingPeople.length)
              .catch((e: any) => this.logger.error(`[scheduler] notifyPolicyAckOverdue: ${e}`));
          }

          for (const person of pendingPeople) {
            const emailType = `policy_ack_${policy.id}_person_${person.id}`;
            const alreadySentInitial = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
              .where(eq(emailDripLogTable.emailType, emailType));

            if (alreadySentInitial.length === 0) {
              try {
                await sendPolicyAcknowledgmentEmail({
                  to: person.email,
                  firstName: person.firstName ?? undefined,
                  policyTitle: policy.title,
                  policyId: policy.id,
                });
                await db.insert(emailDripLogTable).values({ clerkUserId: `person_${person.id}`, orgId: policy.orgId, emailType }).onConflictDoNothing();
                this.logger.log(`[scheduler] policy_ack initial: policy=${policy.id} person=${person.id}`);
              } catch (err) { this.logger.error({ err }, "[scheduler] policy_ack initial failed"); }
            } else if (daysSincePublished >= 3) {
              const reminderKey = `policy_ack_reminder_${policy.id}_person_${person.id}_cycle_${Math.floor(daysSincePublished / 3)}`;
              const alreadySentReminder = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
                .where(eq(emailDripLogTable.emailType, reminderKey));
              if (alreadySentReminder.length === 0) {
                try {
                  await sendPolicyAckReminderEmail({
                    to: person.email,
                    firstName: person.firstName ?? undefined,
                    policyTitle: policy.title,
                    policyId: policy.id,
                    daysPending: Math.floor(daysSincePublished),
                  });
                  await db.insert(emailDripLogTable).values({ clerkUserId: `person_${person.id}`, orgId: policy.orgId, emailType: reminderKey }).onConflictDoNothing();
                  this.logger.log(`[scheduler] policy_ack reminder: policy=${policy.id} person=${person.id}`);
                } catch (err) { this.logger.error({ err }, "[scheduler] policy_ack reminder failed"); }
              }
            }
          }
        } catch (e) { this.logger.error(`[scheduler] policyAck policy=${policy.id}: ${e}`); }
      }
    } catch (e) { this.logger.error(`[scheduler] runPolicyAcknowledgmentSweep: ${e}`); }
    this.logger.log("[scheduler] runPolicyAcknowledgmentSweep done");
  }

  // ── Vendor re-assessment sweep — weekly Monday at 07:00 UTC ─────────────
  @Cron("0 7 * * 1")
  async runVendorReassessmentSweep(): Promise<void> {
    this.logger.log("[scheduler] runVendorReassessmentSweep start");
    try {
      const now = new Date();
      const vendors = await db.query.orgVendorsTable.findMany({
        where: isNotNull(orgVendorsTable.nextAssessmentDue),
      });

      for (const vendor of vendors) {
        if (!vendor.nextAssessmentDue) continue;
        const daysUntilDue = (vendor.nextAssessmentDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilDue > 14 || daysUntilDue < -7) continue;

        const cycleKey = `vendor_reassess_${vendor.id}_${vendor.nextAssessmentDue.getFullYear()}_${vendor.nextAssessmentDue.getMonth()}`;
        const alreadySent = await db.select({ id: emailDripLogTable.id }).from(emailDripLogTable)
          .where(eq(emailDripLogTable.emailType, cycleKey));
        if (alreadySent.length > 0) continue;

        const admins = await this.notificationsSvc.getOrgAdminEmails(vendor.orgId).catch(() => []);
        if (admins.length === 0) continue;

        const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const [assessment] = await db.insert(orgVendorAssessmentsTable).values({
          orgId: vendor.orgId,
          vendorId: vendor.id,
          templateType: "sig-lite",
          status: "sent",
          dueDate,
          totalItems: 30,
          createdBy: "system",
        } as any).returning();

        try {
          await sendVendorAssessmentEmail({
            to: admins[0].email,
            vendorName: vendor.name,
            requesterOrgName: `Org #${vendor.orgId}`,
            templateType: "sig-lite",
            dueDate,
            assessmentId: assessment.id,
          });
          await db.insert(emailDripLogTable).values({ clerkUserId: `vendor_${vendor.id}`, orgId: vendor.orgId, emailType: cycleKey }).onConflictDoNothing();
          this.logger.log(`[scheduler] vendor reassessment sent: vendor=${vendor.id}`);
        } catch (err) { this.logger.error({ err }, "[scheduler] vendor reassessment email failed"); }
      }
    } catch (e) { this.logger.error(`[scheduler] runVendorReassessmentSweep: ${e}`); }
    this.logger.log("[scheduler] runVendorReassessmentSweep done");
  }
}
