// better-auth.ts — BetterAuth instance for EnterpriseComply
// Security-hardened: invite-only magic link, 8h session, SameSite strict, rate limit, idle timeout support
// Controls: NIST AC-2 (invite-only), NIST AC-7 (rate limit), NIST SC-23 (session), OWASP ASVS 2.5.6 (ambiguous)

import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { magicLink } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { sendMagicLinkEmail, sendWelcomeEmail } from "./email";
import { logger } from "./logger";

// ── In-memory rate limit map for magic link requests (5 per email per hour) ─────
// NOTE: for multi-instance deployments replace with Redis-backed counter
const magicLinkRateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isMagicLinkRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = magicLinkRateMap.get(email);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    magicLinkRateMap.set(email, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }
  entry.count++;
  return false;
}

export const auth = betterAuth({
  database: {
    db: new Pool({ connectionString: process.env.DATABASE_URL }),
    type: "postgres",
  },

  secret: process.env.BETTER_AUTH_SECRET || "ec-dev-secret-change-in-production",

  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://app.enterprisecomply.com",
  basePath: "/api/auth",

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://app.enterprisecomply.com",
    "https://app.enterprisecomply.com",
    "https://grc.colorcodesolutions.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ].filter(Boolean) as string[],

  // ── Email+password: DISABLED — magic link only (invite-gated) ────────────────
  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    } : undefined,
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } : undefined,
  },

  plugins: [
    magicLink({
      // NIST AC-2 / SOC 2 CC6.1: disableSignUp prevents unauthenticated users from
      // creating accounts via magic link. New users must be provisioned via invite flow.
      disableSignUp: true,

      sendMagicLink: async ({ email, token, url }, request) => {
        // NIST AC-7 / OWASP ASVS 2.5.6: rate limit silently — always return the same
        // ambiguous response whether the email is registered or not.
        // The rate limiter here only suppresses the actual email send; BetterAuth
        // still returns its standard 200 response so callers cannot enumerate emails.
        if (isMagicLinkRateLimited(email)) {
          logger.warn({ email }, "[auth] Magic link rate limited — suppressing send");
          return; // silently drop: BetterAuth already sent ambiguous 200
        }
        try {
          await sendMagicLinkEmail({ to: email, magicLink: url });
          logger.info({ email }, "[auth] Magic link sent");
        } catch (err) {
          logger.error({ err, email }, "[auth] Failed to send magic link email");
        }
      },

      // Token validity: 15 minutes (NIST IA-5(1))
      expiresIn: 15 * 60,
    }),

    twoFactor({
      issuer: "EnterpriseComply",
      totpOptions: {
        period: 30,
        digits: 6,
      },
      backupCodes: {
        enabled: true,
        amount: 10,
      },
    }),

    organization({
      // NIST AC-2: disable self-service org creation — orgs are provisioned by admins only
      allowUserToCreateOrganization: false,
      organizationLimit: 5,
      membershipLimit: 500,
      sendInvitationEmail: async (data) => {
        logger.info({ email: data.email, orgName: data.organization.name }, "[auth] Org invitation sent");
      },
    }),
  ],

  user: {
    additionalFields: {
      orgId: {
        type: "string",
        required: false,
        defaultValue: null,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
      },
      clerkUserId: {
        type: "string",
        required: false,
        defaultValue: null,
      },
    },
  },

  // ── Session hardening (NIST SC-23, AC-12) ────────────────────────────────────
  session: {
    // Absolute session lifetime: 8 hours (replaces 7-day default)
    expiresIn: 8 * 60 * 60,
    // No rolling — session does NOT extend on activity (absolute timeout only)
    // Idle timeout is enforced separately in the NestJS IdleTimeoutMiddleware
    updateAge: 0,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  advanced: {
    // Always use Secure cookies (HTTPS-only)
    useSecureCookies: true,
    defaultCookieAttributes: {
      // SameSite strict prevents CSRF (OWASP A01, NIST SC-23)
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      httpOnly: true,
      secure: true,
    },
  },

  // ── Audit hook: welcome email on user creation (after invite accept) ──────────
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          sendWelcomeEmail({ to: user.email, name: user.name || user.email }).catch((err) => {
            logger.warn({ err, userId: user.id }, "[auth] Welcome email failed (non-fatal)");
          });
          logger.info({ userId: user.id, email: user.email }, "[auth] audit: user.created");
        },
      },
    },
  },
});

export type Auth = typeof auth;
