/**
 * saml-auth.controller.ts — Public SAML 2.0 SP-initiated auth flow
 *
 * GET  /api/auth/saml/:orgSlug/login     → redirects to IdP
 * POST /api/auth/saml/:orgSlug/callback  → validates assertion, issues session, redirects to app
 *
 * Both endpoints are intentionally unauthenticated (public).
 * The callback is submitted by the IdP directly and must never require a session.
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Req,
  HttpCode,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { SsoService } from "./sso.service";
import { logger } from "../../lib/logger.js";
import { getAppBaseUrl } from "../../lib/saml-sp.js";

@Controller("saml")
@SkipThrottle()
export class SamlAuthController {
  constructor(private readonly ssoSvc: SsoService) {}

  /**
   * SP-initiated login — constructs the SAMLRequest and redirects to the IdP.
   */
  @Get(":orgSlug/login")
  async login(
    @Param("orgSlug") orgSlug: string,
    @Res() res: Response,
  ) {
    try {
      const url = await this.ssoSvc.createLoginUrl(orgSlug);
      return res.redirect(302, url);
    } catch (err) {
      logger.warn({ err, orgSlug }, "[sso] SAML login initiation failed");
      const base = getAppBaseUrl();
      return res.redirect(302, `${base}/sign-in?error=sso_not_configured`);
    }
  }

  /**
   * ACS (Assertion Consumer Service) — validates the SAML assertion posted by the IdP.
   * Issues a BetterAuth session cookie and redirects to the dashboard.
   *
   * The IdP POSTs application/x-www-form-urlencoded with SAMLResponse (base64).
   */
  @Post(":orgSlug/callback")
  @HttpCode(302)
  async callback(
    @Param("orgSlug") orgSlug: string,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = getAppBaseUrl();

    try {
      const { signedToken, expiresAt } = await this.ssoSvc.handleCallback(
        orgSlug,
        body,
        req.ip ?? undefined,
        req.headers["user-agent"] ?? undefined,
      );

      // Set BetterAuth session cookie — same format and attributes as the app's
      // regular magic-link / OAuth sessions so the session guard accepts it.
      const cookieName = "__Secure-better-auth.session_token";
      const cookieOpts = {
        httpOnly:  true,
        secure:    true,
        sameSite:  "lax" as const,
        expires:   expiresAt,
        path:      "/",
      };

      res.cookie(cookieName, signedToken, cookieOpts);
      return res.redirect(302, `${base}/dashboard`);
    } catch (err) {
      logger.warn({ err, orgSlug }, "[sso] SAML callback failed");
      return res.redirect(302, `${base}/sign-in?error=saml_failed`);
    }
  }
}
