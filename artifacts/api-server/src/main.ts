import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { join } from "path";
import { existsSync } from "fs";
import express from "express";

// ── Startup env validation ─────────────────────────────────────────────────
// Validates required env vars on startup and refuses to boot if critical ones
// are missing or malformed. Prevents silent runtime failures (e.g., OAuth typos).
function validateEnv() {
  // Hard requirement: DATABASE_URL (app cannot function without DB)
  if (!process.env.DATABASE_URL) {
    console.error('[STARTUP FAILURE] DATABASE_URL is required but was not provided.');
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

// ── CORS origin resolution ─────────────────────────────────────────────────
// Supports:
//   ALLOWED_ORIGINS=https://app.enterprisecomply.com,https://grc.colorcodesolutions.com
//   ALLOWED_ORIGIN=https://app.enterprisecomply.com  (legacy single-origin support)
// In development (NODE_ENV != production): all origins allowed.
// In production with no env var set: origins blocked.
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

  // ── Security headers (Phase 5 / SOC2 / FedRAMP-ready) ─────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.browser.accounts.dev", "https://*.clerk.accounts.dev"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://*.clerk.accounts.dev",
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
        preload: false, // Set to true only after DNS is fully stable
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xContentTypeOptions: true,
      xFrameOptions: { action: "deny" },
    }),
  );

  // ── Request logging ────────────────────────────────────────────────────
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

  // ── CORS ───────────────────────────────────────────────────────────────
  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
  });

  app.setGlobalPrefix("api");

  // ── Frontend static files (SPA) ────────────────────────────────────────
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
