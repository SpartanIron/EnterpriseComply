// idle-timeout.middleware.ts — NestJS middleware for NIST AC-12 session termination
// Enforces a 30-minute idle timeout on top of BetterAuth's 8-hour absolute session timeout.
// On each authenticated API request the lastActivity timestamp is updated in the session cookie
// header via the X-Session-LastActivity response header that the front end must persist (or via
// a dedicated BetterAuth session attribute update).
//
// Strategy: track lastActivity in a server-side Map keyed by BetterAuth session ID.
// For multi-instance deployments, swap the Map for a Redis TTL store.

import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/better-auth";
import { logger } from "../lib/logger";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (NIST AC-12)

// In-memory store: sessionId → lastActivityMs
// Replace with Redis for multi-instance deployments
const lastActivityMap = new Map<string, number>();

@Injectable()
export class IdleTimeoutMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    // Skip auth routes and health checks — BetterAuth handles its own lifecycle
    if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/health")) {
      return next();
    }

    try {
      // Pass all request headers so BetterAuth has host, origin, cookie etc.
      // Passing only cookie + authorization was causing getSession to return null
      // because BetterAuth v1.6 validates the host against trustedOrigins.
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers as Record<string, string | string[] | undefined>)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }

      const session = await auth.api.getSession({ headers });

      if (session?.session?.id) {
        const sessionId = session.session.id;
        const now = Date.now();
        const lastActivity = lastActivityMap.get(sessionId);

        if (lastActivity !== undefined && now - lastActivity > IDLE_TIMEOUT_MS) {
          // Session has been idle too long — revoke it and return 401
          lastActivityMap.delete(sessionId);
          try {
            await auth.api.revokeSession({ body: { token: session.session.token } });
          } catch {
            // Best-effort revocation — session may already be expired
          }
          logger.info({ sessionId, idleMs: now - lastActivity }, "[auth] Session terminated: idle timeout exceeded");
          res.status(401).json({ error: "session_expired", message: "Session expired due to inactivity. Please sign in again." });
          return;
        }

        // Update last activity timestamp
        lastActivityMap.set(sessionId, now);
      }
    } catch {
      // If we cannot read the session, let BetterAuth handle it downstream
    }

    next();
  }
}
