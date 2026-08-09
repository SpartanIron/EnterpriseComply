/**
 * saml-auth.controller.ts — Public SAML 2.0 SP-initiated auth flow
 *
 * GET  /api/saml/:orgSlug/login     → redirects to IdP
 * POST /api/saml/:orgSlug/callback  → validates assertion, issues session, redirects to app
 *
 * Both endpoints are intentionally unauthenticated (public).
 * The callback is submitted by the IdP directly and must never require a session.
 *
 * Rate limiting (NIST AC-7 / OWASP ASVS 2.1.7):
 *   - Throttled to 5 requests/min per IP via the "auth" throttler profile.
 *   - The callback additionally tracks consecutive failures per IP.
 *     After 10 failures within 15 minutes the IP is blocked for 15 minutes
 *     and receives HTTP 429 with Retry-After: 900 on subsequent requests.
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
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { SsoService } from "./sso.service";
import { logger } from "../../lib/logger.js";
import { getAppBaseUrl } from "../../lib/saml-sp.js";
import {
  isIpBlocked,
  blockRemainingSeconds,
  recordAuthFailure,
  BLOCK_SECONDS,
} from "../../lib/auth-failure-tracker.js";

@Controller("saml")
export class SamlAuthController {
  constructor(private readonly ssoSvc: SsoService) {}

  /**
   * SP-initiated login — constructs the SAMLRequest and redirects to the IdP.
   * Rate-limited to 5 req/min per IP (auth throttler profile).
   */
  @Get(":orgSlug/login")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
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
   *
   * Protection: IP failure block (10 failures → 15-minute block) rather than a
   * per-minute throttle.  The callback requires a cryptographically signed SAML
   * assertion, so volume alone is not a viable attack; the failure block stops
   * assertion-replay and invalid-assertion attempts.  Applying the 5/min throttle
   * here would make the 10-failure threshold unreachable in a single window.
   */
  @Post(":orgSlug/callback")
  @HttpCode(302)
  @SkipThrottle()
  // Explicitly exempt from the default 120/min throttle: the SAML callback
  // is protected solely by the IP failure block (10 failures → 15-min ban).
  // Applying the per-minute throttle here would prevent the failure counter
  // from accumulating past 5, making the 10-failure block unreachable.
  async callback(
    @Param("orgSlug") orgSlug: string,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = getAppBaseUrl();
    const ip   = (req.ips?.length ? req.ips[0] : req.ip) ?? "0.0.0.0";

    // ── IP failure block check (NIST AC-7) ────────────────────────────────
    if (await isIpBlocked(ip)) {
      const retryAfter = await blockRemainingSeconds(ip);
      logger.warn({ ip, orgSlug }, "[sso] SAML callback blocked — too many auth failures");
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many authentication failures. Try again later.",
        retryAfter,
      });
    }

    try {
      const { signedToken, expiresAt } = await this.ssoSvc.handleCallback(
        orgSlug,
        body,
        ip,
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
      // Record the failure; if this call crosses the threshold the IP is now blocked
      const nowBlocked = await recordAuthFailure(ip);
      logger.warn({ err, orgSlug, ip, nowBlocked }, "[sso] SAML callback failed");

      if (nowBlocked) {
        res.setHeader("Retry-After", String(BLOCK_SECONDS));
        return res.redirect(302, `${base}/sign-in?error=too_many_failures`);
      }
      return res.redirect(302, `${base}/sign-in?error=saml_failed`);
    }
  }
}
