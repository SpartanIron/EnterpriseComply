import { Injectable, NestMiddleware } from "@nestjs/common";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Request, Response, NextFunction } from "express";
import type { IncomingHttpHeaders } from "http";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

export function getClerkProxyHost(req: { headers: IncomingHttpHeaders }): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

@Injectable()
export class ClerkProxyMiddleware implements NestMiddleware {
  private readonly handler: (req: Request, res: Response, next: NextFunction) => void;

  constructor() {
    if (process.env.NODE_ENV !== "production" || !process.env.CLERK_SECRET_KEY) {
      this.handler = (_req, _res, next) => next();
      return;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    this.handler = createProxyMiddleware({
      target: CLERK_FAPI,
      changeOrigin: true,
      pathRewrite: (path: string) => path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
      on: {
        proxyReq: (proxyReq, req) => {
          const protocol = req.headers["x-forwarded-proto"] || "https";
          const host = getClerkProxyHost(req) || "";
          const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;
          proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
          proxyReq.setHeader("Clerk-Secret-Key", secretKey);
          const xff = req.headers["x-forwarded-for"];
          const clientIp =
            (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
            req.socket?.remoteAddress || "";
          if (clientIp) proxyReq.setHeader("X-Forwarded-For", clientIp);
        },
      },
    }) as (req: Request, res: Response, next: NextFunction) => void;
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.handler(req, res, next);
  }
}
