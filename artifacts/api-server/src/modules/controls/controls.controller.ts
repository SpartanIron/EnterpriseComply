import { Controller, Get, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { ControlsService } from "./controls.service";
import { ClerkAuthGuard, OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Get("controls/uco")
  @UseGuards(ClerkAuthGuard)
  getUcoControls() {
    return this.controlsService.getUcoControls();
  }

  @Get("orgs/:orgId/controls")
  @UseGuards(OrgContextGuard)
  getOrgControls(@OrgContext() ctx: OrgCtx) {
    return this.controlsService.getOrgControls(ctx.orgId);
  }

  @Get("orgs/:orgId/controls/:controlId/framework-impact")
  @UseGuards(OrgContextGuard)
  getFrameworkImpact(@OrgContext() ctx: OrgCtx, @Param("controlId") controlId: string) {
    return this.controlsService.getFrameworkImpact(ctx.orgId, controlId);
  }

  @Patch("orgs/:orgId/controls/:controlId/result")
  @UseGuards(OrgContextGuard)
  patchControlResult(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("controlId") controlId: string,
    @Body() body: { status: string; remediationNotes?: string },
  ) {
    return this.controlsService.patchControlResult(ctx.orgId, controlId, userId, body);
  }
}
