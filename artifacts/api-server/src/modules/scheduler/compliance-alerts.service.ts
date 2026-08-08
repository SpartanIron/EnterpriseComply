import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  db, organizationsTable, orgControlResultsTable,
  orgRisksTable, orgPoliciesTable,
} from "@workspace/db";
import { eq, and, lt, ne, isNotNull } from "drizzle-orm";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * P1-22: Compliance alerts scheduler.
 * Runs daily, sweeps every org, writes real notifications from real data.
 * All queries are orgId-scoped (same isolation pattern as the rest of the API).
 * Uses deduplication keys in NotificationsService so each alert fires at most
 * once per calendar day per org, regardless of how many times the sweep runs.
 */
@Injectable()
export class ComplianceAlertsService {
  private readonly logger = new Logger(ComplianceAlertsService.name);

  constructor(private readonly notificationsSvc: NotificationsService) {}

  // ── Daily compliance sweep — 07:00 UTC ────────────────────────────────────
  @Cron("0 7 * * *")
  async runComplianceAlertsSweep(): Promise<void> {
    this.logger.log("[compliance-alerts] sweep start");
    try {
      const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable);
      for (const org of orgs) {
        await this.sweepOrg(org.id).catch((err) =>
          this.logger.error(`[compliance-alerts] org=${org.id} error: ${err}`),
        );
      }
    } catch (err) {
      this.logger.error(`[compliance-alerts] sweep failed: ${err}`);
    }
    this.logger.log("[compliance-alerts] sweep done");
  }

  private async sweepOrg(orgId: number): Promise<void> {
    const now = new Date();

    // 1. Evidence expiring within 7 days
    //    Uses the existing runEvidenceExpiryScan helper which queries
    //    org_evidence WHERE expires_at BETWEEN now AND now+7d, scoped by orgId.
    const expiringEvidence = await this.notificationsSvc.runEvidenceExpiryScan(orgId);
    if (expiringEvidence.length > 0) {
      await this.notificationsSvc.notifyEvidenceExpiry(orgId, expiringEvidence);
      this.logger.log(`[compliance-alerts] org=${orgId} evidence-expiry: ${expiringEvidence.length} items`);
    }

    // 2. Failing controls — count org_control_results WHERE status='failing'
    const failingControls = await db
      .select({ id: orgControlResultsTable.id })
      .from(orgControlResultsTable)
      .where(
        and(
          eq(orgControlResultsTable.orgId, orgId),
          eq(orgControlResultsTable.status, "failing"),
        ),
      );
    if (failingControls.length > 0) {
      await this.notificationsSvc.notifyFailingControls(orgId, failingControls.length);
      this.logger.log(`[compliance-alerts] org=${orgId} failing-controls: ${failingControls.length}`);
    }

    // 3. Overdue risks — open/mitigated/accepted risks past their due date
    const overdueRisks = await db
      .select({ id: orgRisksTable.id })
      .from(orgRisksTable)
      .where(
        and(
          eq(orgRisksTable.orgId, orgId),
          ne(orgRisksTable.status, "closed"),
          isNotNull(orgRisksTable.dueDate),
          lt(orgRisksTable.dueDate as any, now),
        ),
      );
    if (overdueRisks.length > 0) {
      await this.notificationsSvc.notifyOverdueRisks(orgId, overdueRisks.length);
      this.logger.log(`[compliance-alerts] org=${orgId} overdue-risks: ${overdueRisks.length}`);
    }

    // 4. Policies not reviewed in 12+ months
    //    Fetch all published policies, filter by lastReviewedAt (or createdAt as fallback).
    //    Policies that have never been reviewed since creation beyond 12 months are included.
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const publishedPolicies = await db
      .select({
        id: orgPoliciesTable.id,
        lastReviewedAt: (orgPoliciesTable as any).lastReviewedAt,
        createdAt: orgPoliciesTable.createdAt,
      })
      .from(orgPoliciesTable)
      .where(
        and(
          eq(orgPoliciesTable.orgId, orgId),
          eq(orgPoliciesTable.status, "published"),
        ),
      );
    const overdueForReview = publishedPolicies.filter((p) => {
      const anchor: Date = p.lastReviewedAt ?? p.createdAt;
      return anchor && new Date(anchor).getTime() < twelveMonthsAgo.getTime();
    });
    if (overdueForReview.length > 0) {
      await this.notificationsSvc.notifyPoliciesDueForReview(orgId, overdueForReview.length);
      this.logger.log(`[compliance-alerts] org=${orgId} policies-overdue-review: ${overdueForReview.length}`);
    }
  }
}
