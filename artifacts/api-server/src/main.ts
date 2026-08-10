import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { join } from "path";
import { randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import express from "express";
import { validateCredentialKeyMaterial } from "./lib/credential-crypto";
import { magicLinkRateLimiterMiddleware } from "./lib/magic-link-rate-limiter";
import { originTrustMiddleware } from "./middleware/origin-trust.middleware.js";

// ── Startup env validation ───────────────────────────────────────────────────────────────────
// Validates required env vars on startup and refuses to boot if critical ones
// are missing or malformed. Prevents silent runtime failures (e.g., OAuth typos).
function validateEnv() {
  // Hard requirement: DATABASE_URL (app cannot function without DB)
  if (!process.env.DATABASE_URL) {
    console.error('[STARTUP FAILURE] DATABASE_URL is required but was not provided.');
    process.exit(1);
  }

  // Hard requirement (production): credential key material must be available.
  // validateCredentialKeyMaterial() throws in non-development environments when
  // neither INTEGRATION_CREDENTIAL_KEY nor SESSION_SECRET is set.
  try {
    validateCredentialKeyMaterial();
  } catch (err) {
    console.error('[STARTUP FAILURE]', (err as Error).message);
    process.exit(1);
  }

  // Soft warnings (log but don't exit — these have defaults or are optional)
  const warnings = [
    !process.env.NODE_ENV && 'NODE_ENV not set (defaulting to development)',
    !process.env.GITHUB_CLIENT_ID && 'GITHUB_CLIENT_ID not set — GitHub OAuth will be disabled',
    !process.env.STRIPE_SECRET_KEY && 'STRIPE_SECRET_KEY not set — billing features will be disabled',
  ].filter(Boolean);

  for (const w of warnings) {
    console.warn('[STARTUP WARNING]', w);
  }

  // Validate GITHUB_CLIENT_ID format if provided (20 alphanumeric chars)
  const githubId = process.env.GITHUB_CLIENT_ID;
  if (githubId && !/^[A-Za-z0-9]{20}$/.test(githubId)) {
    console.warn('[STARTUP WARNING] GITHUB_CLIENT_ID appears malformed (expected 20 chars, got:', githubId.length, '). GitHub OAuth may fail.');
  }
}

// ── CORS origin resolution ───────────────────────────────────────────────────────────────────
function resolveAllowedOrigins(): string[] | boolean {
  const multiOrigin = process.env.ALLOWED_ORIGINS;
  const singleOrigin = process.env.ALLOWED_ORIGIN;

  if (multiOrigin) {
    const origins = multiOrigin
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    logger.info({ origins }, '[CORS] Allowed origins configured');
    return origins;
  }

  if (singleOrigin) {
    logger.info({ origin: singleOrigin }, '[CORS] Single allowed origin configured (legacy)');
    return [singleOrigin];
  }

  if (process.env.NODE_ENV !== 'production') {
    logger.warn('[CORS] Development mode — all origins allowed');
    return true;
  }

  logger.warn('[CORS] Production mode with no ALLOWED_ORIGINS set — blocking all cross-origin requests');
  return false;
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Trust proxy headers ────────────────────────────────────────────────────
  // Railway (and Cloudflare in front of it) forward the real client IP in
  // X-Forwarded-For.  Setting trust proxy makes Express populate req.ip and
  // req.ips from that header so ThrottlerGuard and IP-block logic see the
  // correct source address rather than the proxy's address.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // ── HTTP → HTTPS redirect (origin-level defense-in-depth) ─────────────────────────────
  // Cloudflare handles the 301 in production, but if the Railway origin is ever reached
  // directly over HTTP (bypass, misconfiguration, monitoring) this catches it before any
  // application logic runs. Only active when NODE_ENV=production to avoid breaking local dev.
  if (process.env.NODE_ENV === 'production') {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  // ── Security headers ───────────────────────────────────────────────────────────────────
  // — Origin trust ----------------------------------------------------------
  // First thing in the chain. A request that arrived at the container without
  // coming through an approved public hostname should not reach the security
  // headers, the rate limiter, or any controller. See the middleware for why
  // Authenticated Origin Pulls are not an option on Railway.
  app.use(originTrustMiddleware);

  // — Third-party origins the auth flow depends on -----------------------
  // Clerk serves the sign-in UI and Turnstile serves the bot challenge. These
  // values mirror the Cloudflare edge response-header rule that currently
  // overrides this policy, so that origin and edge can converge on one source of
  // truth and the edge rule can then be retired.
  const CLERK_ORIGINS = [
    "https://clerk.colorcodesolutions.com",
    "https://*.clerk.accounts.dev",
  ];
  const CLERK_SOCKETS = [
    "wss://clerk.colorcodesolutions.com",
    "wss://*.clerk.accounts.dev",
  ];
  const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
  // Escape hatch. If a third-party bundle turns out to need eval() once the edge
  // CSP is retired, set CSP_ALLOW_UNSAFE_EVAL=true as a stopgap rather than
  // shipping a code change during an incident. Off by default, and it is a
  // finding whenever it is on.
  const cspAllowUnsafeEval = process.env.CSP_ALLOW_UNSAFE_EVAL === "true";

  // — Per-request CSP nonce ------------------------------------------------
  // Must run before helmet, because helmet materialises the CSP header inside its
  // own middleware. With a nonce available, script-src no longer needs
  // 'unsafe-inline': the only inline block the SPA ships is the JSON-LD data block
  // in index.html, and the SPA fallback below stamps it with this value.
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.cspNonce = randomBytes(16).toString("base64");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // No 'unsafe-inline': inline blocks must carry the per-request nonce.
          scriptSrc: [
            "'self'",
            (_req: unknown, res: unknown) =>
              `'nonce-${(res as { locals?: { cspNonce?: string } }).locals?.cspNonce ?? ""}'`,
              ...CLERK_ORIGINS,
              TURNSTILE_ORIGIN,
              ...(cspAllowUnsafeEval ? ["'unsafe-eval'"] : []),
          ],
          // style-src keeps 'unsafe-inline' on purpose: React and Tailwind set style
          // attributes at runtime. Style injection cannot execute script, and script-src
          // above is nonce-locked, so this is the residual risk we accept and document.
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: [
            "'self'",
            "https://*.colorcodesolutions.com",
            "https://app.enterprisecomply.com",
            "https://grc.colorcodesolutions.com",
          ...CLERK_ORIGINS,
          ...CLERK_SOCKETS,
          ],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          // Stops an injected <base> tag from re-pointing every relative URL,
          // and stops an injected form from posting credentials off-origin.
          baseUri: ["'none'"],
          formAction: ["'self'", ...CLERK_ORIGINS],
          // Modern equivalent of X-Frame-Options: DENY. Kept alongside the
          // header because CSP wins where both are understood.
          frameAncestors: ["'none'"],
          frameSrc: ["'self'", ...CLERK_ORIGINS, TURNSTILE_ORIGIN],
        workerSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xContentTypeOptions: true,
      xFrameOptions: { action: "deny" },
    }),
  );

  // ── Request logging ───────────────────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────────────────────
  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    // Expose rate-limit headers so the frontend can display quota feedback
    exposedHeaders: [
      'X-Total-Count',
      'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset',
      'X-RateLimit-Limit-auth', 'X-RateLimit-Remaining-auth', 'X-RateLimit-Reset-auth',
      'X-RateLimit-Limit-webhook', 'X-RateLimit-Remaining-webhook', 'X-RateLimit-Reset-webhook',
      'Retry-After',
    ],
  });

  // ── Magic-link IP rate limiter ────────────────────────────────────────────────
  // Must be registered before NestJS routing so it intercepts
  // POST /api/auth/magic-link/send before BetterAuth's wildcard controller runs.
  // Enforces 5 req/min per source IP; blocked IPs receive 429 + Retry-After: 60.
  app.use(magicLinkRateLimiterMiddleware);

  app.setGlobalPrefix("api");

  // ── Frontend static files (SPA) ────────────────────────────────────────────────────────
  const frontendDist = join(process.cwd(), "artifacts/c2s-ciop/dist/public");
  if (existsSync(join(frontendDist, "index.html"))) {
    // index: false so that *every* HTML response goes through the nonce-stamping
    // handler below. express.static would otherwise serve a raw index.html whose
    // inline block has no nonce, and CSP would block it.
    app.use(express.static(frontendDist, { index: false }));
    // Serve index.html for all non-API routes (SPA fallback)
    const indexHtmlTemplate = readFileSync(join(frontendDist, "index.html"), "utf8");
    const nestApp = app.getHttpAdapter().getInstance();
    nestApp.get(/^(?!\/api).*/, (_req: express.Request, res: express.Response) => {
      const nonce = (res.locals as { cspNonce?: string }).cspNonce ?? "";
      // split/join, not a regex: linear and no backtracking. The nonce is base64,
      // so it cannot break out of the attribute it is placed in.
      res
        .type("html")
        .send(indexHtmlTemplate.split("<script").join(`<script nonce="${nonce}"`));
    });
  }

  const port = Number(process.env.PORT) || 8080;
  // Final database-integrity sweep. app.init() has already run every
  // bootstrap hook, so any table a service created for itself now exists and
  // will pick up its tenant RLS policy before the first request is served.
  try {
    await app.init();
    const { WormLedgerService } = await import(
      "./modules/evidence/worm-ledger.service.js"
    );
    await app
      .get(WormLedgerService, { strict: false })
      .runIntegrityMigrations();
  } catch (err) {
    logger.error(
      "Final integrity sweep failed: " + ((err as any)?.message ?? String(err)),
    );
  }

  await app.listen(port);
  logger.info({ port }, "API server listening");
}

bootstrap().catch((err) => {
  logger.error(err, "Fatal startup error");
  process.exit(1);
});
