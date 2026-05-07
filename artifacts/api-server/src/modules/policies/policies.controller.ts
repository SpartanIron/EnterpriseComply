import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { PoliciesService } from "./policies.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get("policies/templates")
  getTemplates() {
    return this.policiesService.getTemplates();
  }

  @Get("orgs/:orgId/policies")
  @UseGuards(OrgContextGuard)
  getOrgPolicies(@OrgContext() ctx: OrgCtx) {
    return this.policiesService.getOrgPolicies(ctx.orgId);
  }

  @Post("orgs/:orgId/policies")
  @UseGuards(OrgContextGuard)
  createPolicy(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.policiesService.createPolicy(ctx.orgId, body);
  }
}
