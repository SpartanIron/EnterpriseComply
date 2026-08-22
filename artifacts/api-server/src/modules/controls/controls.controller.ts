import { Controller, Get, Patch, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ControlsService } from "./controls.service";
import { ClerkAuthGuard, OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

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
  @UseGuards(OrgContextGuard, RequireRole("analyst"))
  patchControlResult(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("controlId") controlId: string,
    @Body() body: { status: string; remediationNotes?: string },
  ) {
    return this.controlsService.patchControlResult(ctx.orgId, controlId, userId, body);
  }
  /**
   * Withdraw a result that an integration wrote.
   *
   * owner, where the patch route above is analyst. Recording an assessment is
   * an analyst's job; removing a recorded assertion from the compliance
   * history is not, and the audit entry the service writes names whoever did
   * it.
   */
  @Post("orgs/:orgId/controls/:controlId/clear-automated-result")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  clearAutomatedResult(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("controlId") controlId: string,
  ) {
    return this.controlsService.clearAutomatedResult(ctx.orgId, controlId, userId);
  }
}
