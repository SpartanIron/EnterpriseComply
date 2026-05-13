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
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'NODE_ENV',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('[STARTUP FAILURE] Missing required env vars:', missing.join(', '));
    process.exit(1);
  }

  // Validate GITHUB_CLIENT_ID format (20 alphanumeric chars)
  const githubId = process.env.GITHUB_CLIENT_ID;
  if (githubId && !/^[A-Za-z0-9]{20}$/.test(githubId)) {
    console.error('[STARTUP WARNING] GITHUB_CLIENT_ID appears malformed (expected 20 alphanumeric chars, got:', githubId.length, 'chars). GitHub OAuth may fail.');
  }

  // Validate STRIPE_SECRET_KEY format
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && !stripeKey.startsWith('sk_')) {
    console.error('[STARTUP WARNING] STRIPE_SECRET_KEY does not start with sk_ — Stripe payments may fail.');
  }
}

async function bootstrap() {
  validateEnv();
      const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(
          helmet({
                    contentSecurityPolicy: false,
                    crossOriginEmbedderPolicy: false,
          }),
        );
  // ── OpenAPI / Swagger spec ─────────────────────────────────────────────────
  // Install @nestjs/swagger and uncomment to enable API documentation at /api/docs
  // Requires: pnpm add @nestjs/swagger swagger-ui-express in api-server
  // Then uncomment: const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
  // See docs: https://docs.nestjs.com/openapi/introduction
  console.log('[API] For Swagger docs, install @nestjs/swagger and enable in main.ts');


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

  const allowedOrigin = process.env.ALLOWED_ORIGIN;
      app.enableCors({
              credentials: true,
              origin: allowedOrigin
                ? [allowedOrigin]
                        : process.env.NODE_ENV === "production"
                ? false
                        : true,
      });
      app.setGlobalPrefix("api");

  // Serve frontend static files if the dist directory exists
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
