import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from "@nestjs/common";
import { OrgsService } from "./orgs.service";
import { ClerkAuthGuard, OrgContextGuard, ClerkUserId, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get("me")
  @UseGuards(ClerkAuthGuard)
  getMe(@ClerkUserId() userId: string) {
    return this.orgsService.getMe(userId);
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  createOrg(@ClerkUserId() userId: string, @Body() body: Record<string, unknown>) {
    return this.orgsService.createOrg(userId, body as any);
  }

  @Patch(":orgId")
  @UseGuards(OrgContextGuard)
  updateOrg(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.orgsService.updateOrg(ctx.orgId, body);
  }

  @Patch(":orgId/onboarding")
  @UseGuards(OrgContextGuard)
  patchOnboarding(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { step: number; complete?: boolean },
  ) {
    return this.orgsService.patchOnboarding(ctx.orgId, body.step, body.complete);
  }

  @Get(":orgId/dashboard")
  @UseGuards(OrgContextGuard)
  getDashboard(@OrgContext() ctx: OrgCtx) {
    return this.orgsService.getDashboard(ctx.orgId, ctx.org as Parameters<OrgsService["getDashboard"]>[1]);
  }
}
