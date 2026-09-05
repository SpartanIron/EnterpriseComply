import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
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
 * Config/parse-metadata require authentication + org context (admin role +
 * enterprise plan). The SP metadata endpoint below is the one exception --
 * see the comment on that route for why.
 */
@Controller("orgs/:orgId/sso")
export class SsoController {
    constructor(private readonly ssoSvc: SsoService) {}

    // ── SP metadata — PUBLIC, unauthenticated ────────────────────────────
    // SAML SP metadata is not sensitive: it only contains our SP entity ID,
    // ACS URL, and the *public* half of our signing certificate (the
    // private key never leaves the server). Every SAML IdP (Okta, Entra ID,
    // OneLogin, Ping, Keycloak, etc.) expects to fetch this over a plain
    // HTTPS URL with no session, often automatically to pick up certificate
    // rotations -- gating it behind our own app auth breaks that standard
    // "metadata URL" federation flow entirely (this is what caused
    // "Invalid requester" failures against Keycloak's metadata-URL mode).
    //
    // This was previously authenticated (admin+enterprise), which was a
    // mismatch with SAML norms rather than a deliberate access-control
    // decision. It already sits in the "public / exempt" tier alongside
    // /api/healthz and /api/auth-providers in docs/rate-limiting-audit.md
    // and already carries @SkipThrottle() for that reason -- only the auth
    // guard was inconsistent with that classification, which this fixes.
    // A short Cache-Control header is added so IdPs that poll for cert
    // rotation don't need to hit the DB on every check.
    @Get("metadata")
    @Header("Content-Type", "application/xml; charset=utf-8")
    @Header("Cache-Control", "public, max-age=600")
    @SkipThrottle()
    async getMetadata(
        @Param("orgId", ParseIntPipe) orgId: number,
        @Res() res: Response,
    ) {
        const xml = await this.ssoSvc.getSpMetadata(orgId);
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
