import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Res,
    Header,
    HttpCode,
} from "@nestjs/common";
import type { Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { SsoService } from "./sso.service";
import type { SaveSsoConfigDto, ParseMetadataDto } from "./sso.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx { orgId: number; org: any; member: any }

/**
 * Org-scoped SSO configuration endpoints.
 * All require authentication + org context.
 * Config mutations require admin role + enterprise plan.
 */
@Controller("orgs/:orgId/sso")
  export class SsoController {
    constructor(private readonly ssoSvc: SsoService) {}

  // ── SP metadata — read-only, admin only (they need to paste it into IdP) ──
  @Get("metadata")
    @UseGuards(OrgContextGuard, RequireRole("admin"), RequirePlan("enterprise"))
    @Header("Content-Type", "application/xml; charset=utf-8")
    @SkipThrottle()
    async getMetadata(@OrgContext() ctx: OrgCtx, @Res() res: Response) {
          const xml = await this.ssoSvc.getSpMetadata(ctx.orgId);
          res.status(200).send(xml);
    }

  // ── GET config — returns current IdP config (full cert for editing) ────
  @Get("config")
    @UseGuards(OrgContextGuard, RequireRole("admin"), RequirePlan("enterprise"))
    async getConfig(@OrgContext() ctx: OrgCtx) {
          return this.ssoSvc.getSsoConfig(ctx.orgId);
    }

  // ── POST config — save/update IdP details ────────────────────
  @Post("config")
    @HttpCode(200)
    @UseGuards(OrgContextGuard, RequireRole("admin"), RequirePlan("enterprise"))
    async saveConfig(
          @OrgContext() ctx: OrgCtx,
          @Body() dto: SaveSsoConfigDto,
        ) {
          return this.ssoSvc.saveSsoConfig(ctx.orgId, dto);
    }

  // ── POST parse-metadata — "Upload IdP Metadata XML" / "Metadata URL" ────
  // Accepts either { xml } (pasted/uploaded metadata text) or { url } (a
  // metadata endpoint to fetch, via the SSRF-guarded client). Returns the
  // extracted idpEntityId / idpSsoUrl / idpSloUrl / idpCertificate so the
  // frontend can pre-fill the manual fields -- this does not save anything.
  @Post("parse-metadata")
    @HttpCode(200)
    @UseGuards(OrgContextGuard, RequireRole("admin"), RequirePlan("enterprise"))
    async parseMetadata(
          @OrgContext() _ctx: OrgCtx,
          @Body() dto: ParseMetadataDto,
        ) {
          return this.ssoSvc.parseMetadata(dto);
    }
}
