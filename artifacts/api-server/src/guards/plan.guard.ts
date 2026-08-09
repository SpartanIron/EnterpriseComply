// plan.guard.ts — Plan-tier feature gating for EnterpriseComply
//
// Usage: @UseGuards(OrgContextGuard, RequirePlan('federal'))
//
// OrgContextGuard MUST run first (it sets req.org). Always combine:
//   @UseGuards(OrgContextGuard, RequirePlan('enterprise'))
//
// Plan hierarchy (higher = more access):
//   starter(0) < professional(1) < enterprise(2) < federal(3)
//
// Gated endpoints (P1-07):
//   federal:    POST/GET/PATCH/DELETE /orgs/:orgId/poam
//               GET /orgs/:orgId/sprs
//               POST /orgs/:orgId/ssp/generate
//               POST /orgs/:orgId/ssp/export-text
//               GET/POST/PATCH/DELETE /orgs/:orgId/stigs/*
//               POST /orgs/:orgId/scap/*
//               POST/GET /orgs/:orgId/emass/* (org-scoped)
//               GET /orgs/:orgId/zero-trust/crosswalk
//   enterprise: PATCH /orgs/:orgId/audit-retention
//               GET/PATCH /orgs/:orgId/sso (added in Task #28)

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Type,
} from "@nestjs/common";

export const PLAN_HIERARCHY: Record<string, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
  federal: 3,
};

export type PlanTier = "starter" | "professional" | "enterprise" | "federal";

/**
 * Factory that returns a guard class requiring at least `minimumPlan`.
 * OrgContextGuard must run before this guard so that req.org is populated.
 *
 * Returns HTTP 402 Payment Required with a structured body:
 *   { error: 'plan_required', requiredPlan, currentPlan, message }
 *
 * The frontend intercepts 402 in apiFetch() and redirects to
 * /pricing?required=<requiredPlan>.
 */
export function RequirePlan(minimumPlan: PlanTier): Type<CanActivate> {
  @Injectable()
  class PlanGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      const org = req.org as Record<string, unknown> | undefined;
      const currentPlan = (org?.plan as string) ?? "starter";
      const currentLevel = PLAN_HIERARCHY[currentPlan] ?? 0;
      const requiredLevel = PLAN_HIERARCHY[minimumPlan] ?? 0;

      if (currentLevel < requiredLevel) {
        throw new HttpException(
          {
            error: "plan_required",
            requiredPlan: minimumPlan,
            currentPlan,
            message:
              `This feature requires the '${minimumPlan}' plan or higher. ` +
              `Your current plan: '${currentPlan}'. ` +
              `Please upgrade at /pricing to access this feature.`,
          },
          HttpStatus.PAYMENT_REQUIRED, // 402
        );
      }
      return true;
    }
  }
  return PlanGuard;
}
