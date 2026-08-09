import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { join } from "path";
import { existsSync } from "fs";
import express from "express";
import { validateCredentialKeyMaterial } from "./lib/credential-crypto";

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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://*.colorcodesolutions.com",
            "https://app.enterprisecomply.com",
            "https://grc.colorcodesolutions.com",
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
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

  app.setGlobalPrefix("api");

  // ── Frontend static files (SPA) ────────────────────────────────────────────────────────
  const frontendDist = join(process.cwd(), "artifacts/c2s-ciop/dist/public");
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // Serve index.html for all non-API routes (SPA fallback)
    const nestApp = app.getHttpAdapter().getInstance();
    nestApp.get(/^(?!\/api).*/, (_req: express.Request, res: express.Response) => {
      res.sendFile(join(frontendDist, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port);
  logger.info({ port }, "API server listening");
}

bootstrap().catch((err) => {
  logger.error(err, "Fatal startup error");
  process.exit(1);
});
