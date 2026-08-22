import { Controller, Get, Post, Body, Query, Param, Req, Res, UseGuards, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import { IntegrationsService } from "./integrations.service";
import { ClerkAuthGuard, OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { connectorSpec } from "./connector-specs";

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
  @UseGuards(OrgContextGuard, RequireRole("owner"))
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
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncGitHub(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgGitHub(ctx.orgId);
  }

  // ── GitHub PAT (Personal Access Token) connect — direct, no OAuth ───────────
  @Post("orgs/:orgId/integrations/github/connect-pat")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectGitHubPAT(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { personalAccessToken: string; orgOrOwner?: string },
  ) {
    if (!body.personalAccessToken) throw new BadRequestException("personalAccessToken is required");
    return this.integrationsService.connectGitHub(ctx.orgId, body.personalAccessToken, body.orgOrOwner);
  }

  // ── AWS connect / sync ───────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/aws/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
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
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncAWS(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgAWS(ctx.orgId);
  }

  // ── Okta connect / sync ──────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/okta/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectOkta(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { domain: string; apiToken: string },
  ) {
    if (!body.domain || !body.apiToken) throw new BadRequestException("domain and apiToken are required");
    return this.integrationsService.connectOkta(ctx.orgId, body.domain, body.apiToken);
  }

  @Post("orgs/:orgId/integrations/okta/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncOkta(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgOkta(ctx.orgId);
  }

  // ── Railway connect / sync ───────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/railway/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectRailway(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { apiToken: string },
  ) {
    if (!body.apiToken) throw new BadRequestException("apiToken is required");
    return this.integrationsService.connectRailway(ctx.orgId, body.apiToken);
  }

  @Post("orgs/:orgId/integrations/railway/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncRailway(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgRailway(ctx.orgId);
  }

  // ── Replit connect / sync ────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/replit/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectReplit(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { apiToken: string },
  ) {
    if (!body.apiToken) throw new BadRequestException("apiToken is required");
    return this.integrationsService.connectReplit(ctx.orgId, body.apiToken);
  }

  @Post("orgs/:orgId/integrations/replit/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncReplit(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgReplit(ctx.orgId);
  }

  // ── BetterAuth connect / sync ────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/betterauth/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectBetterAuth(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { apiKey: string; baseUrl: string },
  ) {
    if (!body.apiKey || !body.baseUrl) throw new BadRequestException("apiKey and baseUrl are required");
    return this.integrationsService.connectBetterAuth(ctx.orgId, body.apiKey, body.baseUrl);
  }

  @Post("orgs/:orgId/integrations/betterauth/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncBetterAuth(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgBetterAuth(ctx.orgId);
  }

  // ── Cloudflare connect / sync ─────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/cloudflare/connect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectCloudflare(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { apiToken: string; zoneId: string },
  ) {
    if (!body.apiToken || !body.zoneId) throw new BadRequestException("apiToken and zoneId are required");
    return this.integrationsService.connectCloudflare(ctx.orgId, body.apiToken, body.zoneId);
  }

  @Post("orgs/:orgId/integrations/cloudflare/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncCloudflare(@OrgContext() ctx: OrgCtx) {
    return this.integrationsService.syncOrgCloudflare(ctx.orgId);
  }

  // ── Verify connection (on-demand ping) ──────────────────────────────────────
  @Post("orgs/:orgId/integrations/:key/verify")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  verifyConnection(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.integrationsService.verifyIntegrationConnection(ctx.orgId, key);
  }

  // ---- Disconnect (revoke stored credentials, keep audit history) ----
  @Post("orgs/:orgId/integrations/:key/disconnect")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  disconnectIntegration(
    @OrgContext() ctx: OrgCtx,
    @Param("key") key: string,
    @Req() req: Request,
  ) {
    return this.integrationsService.disconnectIntegration(ctx.orgId, key, {
      userId: ctx.member?.clerkUserId as string | undefined,
      email: ctx.member?.email as string | undefined,
      ip: req.ip,
    });
  }

  // ── Credential-based connectors ───────────────────────────────────────────────
  //
  // What used to be here was POST .../:key/demo-connect, which called
  // connectDemo() and wrote fabricated control results into the tenant. The
  // route is deleted rather than deprecated: leaving it reachable would leave
  // the fabrication one HTTP call away.

  /**
   * The connector catalogue as the browser may see it.
   *
   * Public within the org context because it is the same information the
   * Integrations page needs to render a form: field names, labels, which fields
   * are secret, and - for the ones that are not available - the reason. The
   * verification request itself is not included; see publicSpec.
   */
  @Get("integrations/connector-specs")
  @UseGuards(OrgContextGuard)
  getConnectorSpecs() {
    return this.integrationsService.getConnectorSpecs();
  }

  /**
   * Connect with credentials the customer supplied.
   *
   * owner, matching every other connect route in this controller. Storing a
   * third-party credential that can read the customer's identity provider or
   * their cloud account is the most consequential thing this API does, and it
   * is not an operational action.
   */
  @Post("orgs/:orgId/integrations/:key/connect-credentials")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  connectWithCredentials(
    @OrgContext() ctx: OrgCtx,
    @Param("key") key: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.integrationsService.connectWithSpec(ctx.orgId, key, body, {
      userId: ctx.member?.clerkUserId as string | undefined,
      email: ctx.member?.email as string | undefined,
      ip: req.ip,
    });
  }

  /**
   * Re-run the stored credential's verification.
   *
   * admin rather than owner: this reads a stored credential and changes nothing
   * except the recorded health of the connection, which is a monitoring action.
   */
  @Post("orgs/:orgId/integrations/:key/verify-credentials")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  verifyCredentials(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.integrationsService.verifySpecConnection(ctx.orgId, key);
  }

  // ── Generic sync router ────────────────────────────────────────────────────────
  @Post("orgs/:orgId/integrations/:key/sync")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  syncIntegration(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    if (key === "github") return this.integrationsService.syncOrgGitHub(ctx.orgId);
    if (key === "aws") return this.integrationsService.syncOrgAWS(ctx.orgId);
    if (key === "okta") return this.integrationsService.syncOrgOkta(ctx.orgId);
    if (key === "cloudflare") return this.integrationsService.syncOrgCloudflare(ctx.orgId);
    if (key === "railway") return this.integrationsService.syncOrgRailway(ctx.orgId);
    if (key === "replit") return this.integrationsService.syncOrgReplit(ctx.orgId);
    if (key === "betterauth") return this.integrationsService.syncOrgBetterAuth(ctx.orgId);
        if (key === "slack") return this.integrationsService.syncOrgSlack(ctx.orgId);
    // Was: "use demo-connect to simulate". There is nothing to simulate any
    // more. A connector whose credentials verify but whose evidence collection
    // is not built reports success: false with the reason, so a caller cannot
    // read a no-op as a completed sync.
            if (key === "bamboohr") return this.integrationsService.syncOrgBambooHR(ctx.orgId);
    const spec = connectorSpec(key);
    return {
      success: false,
      collects: spec?.collects ?? "connection-only",
      message:
        spec?.state === "unavailable"
          ? (spec.unavailableReason ?? "This connector is not available yet.")
          : "Credentials for this integration are stored and verified, but automated control testing for it " +
            "is not implemented yet. Nothing was collected and no control results changed.",
    };
  }
}
