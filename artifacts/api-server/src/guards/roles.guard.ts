// roles.guard.ts — Role-based access control for EnterpriseComply
//
// Usage: @UseGuards(OrgContextGuard, RequireRole('admin'))
//
// OrgContextGuard MUST run first (it sets req.member). Always combine:
//   @UseGuards(OrgContextGuard, RequireRole('compliance_manager'))
//
// Role hierarchy (higher = more permissions):
//   viewer(0) < auditor(1) < analyst(2) = member(2) < compliance_manager(3) < admin(4) < owner(5) < super_admin(6)
//
// Tier summary:
//   owner        — org settings, framework activation, integration connect/disconnect
//   admin        — people, vendors, audits, audit-shares, access-review campaigns, custom-frameworks
//   compliance_manager — evidence delete, controls, POA&M, policies, risks delete, remediation, STIGs, assets, gap-analysis
//   analyst/member — create/update risks, evidence, questionnaire answers (default role on invite)
//   auditor      — read-only (attestation submissions only)
//   viewer       — read-only

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Type,
} from "@nestjs/common";

// Numeric hierarchy: higher = more permissions
export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  auditor: 1,
  analyst: 2,
  member: 2,           // legacy default — same level as analyst
  compliance_manager: 3,
  admin: 4,
  owner: 5,
  super_admin: 6,
};

/**
 * Factory that returns a guard class requiring at least `minRole`.
 *
 * Example:
 *   @UseGuards(OrgContextGuard, RequireRole('admin'))
 *   @Delete(':id')
 *   deleteVendor(...)
 */
export function RequireRole(minRole: string): Type<CanActivate> {
  @Injectable()
  class RoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      const memberRole: string = req.member?.role ?? "viewer";
      const memberLevel = ROLE_HIERARCHY[memberRole] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

      if (memberLevel < requiredLevel) {
        throw new ForbiddenException(
          `Insufficient permissions. This action requires '${minRole}' role or higher. Your role: '${memberRole}'.`,
        );
      }
      return true;
    }
  }
  return RoleGuard;
}
