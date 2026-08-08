import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from "@nestjs/common";
import { OrgsService } from "./orgs.service";
import { ClerkAuthGuard, OrgContextGuard, ClerkUserId, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

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

  @Get("me/role")
  @UseGuards(ClerkAuthGuard)
  getMyRole(@ClerkUserId() userId: string) {
    return this.orgsService.getMyRole(userId);
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  createOrg(@ClerkUserId() userId: string, @Body() body: Record<string, unknown>) {
    return this.orgsService.createOrg(userId, body as any);
  }

  // GET /orgs/admin — returns all orgs for super_admin users.
  // Must be declared before :orgId routes so "admin" is not parsed as an orgId.
  @Get("admin")
  @UseGuards(ClerkAuthGuard)
  getAllOrgs(@ClerkUserId() userId: string) {
    return this.orgsService.getAllOrgsForAdmin(userId);
  }

  @Get(":orgId/members")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  // P0-REGRESSION: "org_admin" is not a valid role in ROLE_HIERARCHY — it resolves to
  // level 0 (same as viewer), meaning any org member could list all members.
  // Fixed to "admin" (level 4), matching the intent of the original P0-12/P0-13 work.
  getOrgMembers(@OrgContext() ctx: OrgCtx) {
    return this.orgsService.getOrgMembers(ctx.orgId);
  }

  @Patch(":orgId")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  updateOrg(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.orgsService.updateOrg(ctx.orgId, body);
  }

  @Patch(":orgId/onboarding")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
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
