import { Controller, Get, Post, Query, Param, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { IntegrationsService } from "./integrations.service";
import { ClerkAuthGuard, OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("integrations/catalog")
  getCatalog() {
    return this.integrationsService.getCatalog();
  }

  @Get("orgs/:orgId/integrations")
  @UseGuards(OrgContextGuard)
  getOrgIntegrations(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.getOrgIntegrations(ctx.orgId);
  }

  @Get("integrations/github/connect")
  @UseGuards(ClerkAuthGuard)
  githubConnect(
    @ClerkUserId() userId: string,
    @Query("orgId") orgId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
    const url = this.integrationsService.buildGithubAuthUrl(orgId, userId, host, protocol);
    res.redirect(url);
  }

  @Get("integrations/github/callback")
  async githubCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
    const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
    const { redirectUrl } = await this.integrationsService.handleGithubCallback(code, state, host, protocol, basePath);
    res.redirect(redirectUrl);
  }

  @Post("orgs/:orgId/integrations/github/sync")
  @UseGuards(OrgContextGuard)
  syncGitHub(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgGitHub(ctx.orgId);
  }

  @Post("orgs/:orgId/integrations/:key/demo-connect")
  @UseGuards(OrgContextGuard)
  demoConnect(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.integrationsService.connectDemo(ctx.orgId, key);
  }
}
