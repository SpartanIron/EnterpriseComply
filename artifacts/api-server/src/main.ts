import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { join } from "path";
import { existsSync } from "fs";
import express from "express";

async function bootstrap() {
      const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(
          helmet({
                    contentSecurityPolicy: false,
                    crossOriginEmbedderPolicy: false,
          }),
        );

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
