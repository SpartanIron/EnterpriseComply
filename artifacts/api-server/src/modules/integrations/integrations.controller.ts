import { Controller, Get, Post, Body, Query, Param, Req, Res, UseGuards, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import { IntegrationsService } from "./integrations.service";
import { ClerkAuthGuard, OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("integrations/catalog")
  getCatalog() { return this.integrationsService.getCatalog(); }

  @Get("orgs/:orgId/integrations")
  @UseGuards(OrgContextGuard)
  getOrgIntegrations(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.getOrgIntegrations(ctx.orgId);
  }

  // ── GitHub OAuth connect ────────────────────────────────────────────────────
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

  // ── GitHub PAT (Personal Access Token) connect — direct, no OAuth ───────────
  @Post("orgs/:orgId/integrations/github/connect-pat")
  @UseGuards(OrgContextGuard)
  connectGitHubPAT(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { personalAccessToken: string; orgOrOwner?: string },
  ) {
    if (!body.personalAccessToken) throw new BadRequestException("personalAccessToken is required");
    return this.integrationsService.connectGitHub(ctx.orgId, body.personalAccessToken, body.orgOrOwner);
  }

  // ── AWS connect / sync ───────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/aws/connect")
  @UseGuards(OrgContextGuard)
  connectAWS(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { accessKeyId: string; secretAccessKey: string; region: string },
  ) {
    if (!body.accessKeyId || !body.secretAccessKey || !body.region) {
      throw new BadRequestException("accessKeyId, secretAccessKey, and region are required");
    }
    return this.integrationsService.connectAWS(ctx.orgId, body.accessKeyId, body.secretAccessKey, body.region);
  }

  @Post("orgs/:orgId/integrations/aws/sync")
  @UseGuards(OrgContextGuard)
  syncAWS(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgAWS(ctx.orgId);
  }

  // ── Okta connect / sync ──────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/okta/connect")
  @UseGuards(OrgContextGuard)
  connectOkta(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { domain: string; apiToken: string },
  ) {
    if (!body.domain || !body.apiToken) throw new BadRequestException("domain and apiToken are required");
    return this.integrationsService.connectOkta(ctx.orgId, body.domain, body.apiToken);
  }

  @Post("orgs/:orgId/integrations/okta/sync")
  @UseGuards(OrgContextGuard)
  syncOkta(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgOkta(ctx.orgId);
  }

  // ── Cloudflare connect / sync ─────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/cloudflare/connect")
  @UseGuards(OrgContextGuard)
  connectCloudflare(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { apiToken: string; zoneId: string },
  ) {
    if (!body.apiToken || !body.zoneId) throw new BadRequestException("apiToken and zoneId are required");
    return this.integrationsService.connectCloudflare(ctx.orgId, body.apiToken, body.zoneId);
  }

  @Post("orgs/:orgId/integrations/cloudflare/sync")
  @UseGuards(OrgContextGuard)
  syncCloudflare(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgCloudflare(ctx.orgId);
  }

  // ── Demo connect for all other integrations ───────────────────────────────────
  @Post("orgs/:orgId/integrations/:key/demo-connect")
  @UseGuards(OrgContextGuard)
  demoConnect(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.integrationsService.connectDemo(ctx.orgId, key);
  }

  // ── Generic sync router ────────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/:key/sync")
  @UseGuards(OrgContextGuard)
  syncIntegration(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    if (key === "github") return this.integrationsService.syncOrgGitHub(ctx.orgId);
    if (key === "aws") return this.integrationsService.syncOrgAWS(ctx.orgId);
    if (key === "okta") return this.integrationsService.syncOrgOkta(ctx.orgId);
    if (key === "cloudflare") return this.integrationsService.syncOrgCloudflare(ctx.orgId);
    return { success: true, message: "No live sync available for this integration — use demo-connect to simulate." };
  }
}
