import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
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

  @Patch("orgs/:orgId/policies/:id")
  @UseGuards(OrgContextGuard)
  updatePolicy(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.policiesService.updatePolicy(ctx.orgId, Number(id), body);
  }

  @Delete("orgs/:orgId/policies/:id")
  @UseGuards(OrgContextGuard)
  deletePolicy(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.deletePolicy(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/policies/:id/acknowledgments")
  @UseGuards(OrgContextGuard)
  getAcknowledgments(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.getAcknowledgments(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/policies/:id/acknowledge")
  @UseGuards(OrgContextGuard)
  acknowledgePolicy(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: { personId: number; ipAddress?: string },
  ) {
    return this.policiesService.acknowledgePolicy(ctx.orgId, Number(id), body);
  }

  @Post("orgs/:orgId/policies/:id/request-acknowledgment")
  @UseGuards(OrgContextGuard)
  requestAcknowledgment(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.bulkRequestAcknowledgment(ctx.orgId, Number(id));
  }
}
