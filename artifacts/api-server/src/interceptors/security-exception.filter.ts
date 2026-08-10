import { ArgumentsHost, Catch, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { writeSecurityEvent } from "../lib/audit-log.js";

/**
 * Records authentication and authorisation failures.
 *
 * This exists because of a real gap found by the regression suite: NestJS
 * runs guards *before* interceptors, so when `OrgContextGuard` rejects a
 * request for another tenant's data the interceptor's handler is never
 * subscribed and the attempt is never logged. Every cross-tenant probe was
 * being refused correctly and recorded nowhere — the exact events a SOC needs
 * most were the only ones missing.
 *
 * An exception filter does see guard failures, so detection lives here.
 *
 * Rules:
 *  - the response is completely unchanged; `super.catch` still does the work
 *  - an audit write must never turn a 403 into a 500, so it is fire and
 *    forget with its own catch
 *  - `__securityEventRecorded` prevents double counting when the interceptor
 *    has already recorded a handler-thrown error
 *
 * NIST AU-2, AU-6, SI-4(4). SOC 2 CC6.1, CC7.2.
 */
@Catch()
export class SecurityExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SecurityExceptionFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    try {
      if (host.getType() === "http") {
        const req = host.switchToHttp().getRequest();
        const status =
          (exception as any)?.status ?? (exception as any)?.statusCode ?? 500;
        if ((status === 401 || status === 403) && !req?.__securityEventRecorded) {
          req.__securityEventRecorded = true;
          void this.record(req, status);
        }
      }
    } catch {
      /* never let telemetry change the response */
    }
    super.catch(exception, host);
  }

  private async record(req: any, status: number): Promise<void> {
    try {
      // req.orgId is the *caller's* organisation, set by OrgContextGuard
      // before it compares the URL. That is the right owner for the event:
      // the interesting question is "which tenant went looking", not "which
      // tenant was looked at".
      const orgId = Number(req?.orgId);
      if (!Number.isInteger(orgId) || orgId <= 0) return;

      const path = String(req?.originalUrl ?? req?.url ?? "").split("?")[0];
      const attemptedOrgId = Number(req?.params?.orgId);

      await writeSecurityEvent(
        orgId,
        status === 401 ? "unauthenticated_request" : "authorization_denied",
        this.resourceOf(path),
        {
          method: req?.method ?? "GET",
          path,
          status,
          attemptedOrgId: Number.isInteger(attemptedOrgId) ? attemptedOrgId : null,
          crossTenant:
            Number.isInteger(attemptedOrgId) && attemptedOrgId !== orgId,
          source: "guard",
        },
        req?.clerkUserId ?? undefined,
        req?.member?.email ?? undefined,
        this.ipOf(req),
      );
    } catch (err) {
      this.logger.warn(
        "could not record security event: " +
          ((err as any)?.message ?? String(err)),
      );
    }
  }

  private resourceOf(path: string): string {
    const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
    const orgsIdx = parts.indexOf("orgs");
    const scoped = orgsIdx >= 0 ? parts.slice(orgsIdx + 2) : parts;
    return scoped[0] ?? parts[0] ?? "unknown";
  }

  private ipOf(req: any): string | undefined {
    const cf = req?.headers?.["cf-connecting-ip"];
    if (typeof cf === "string" && cf) return cf.slice(0, 45);
    const xff = req?.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff) return xff.split(",")[0].trim().slice(0, 45);
    const ip = req?.ip ?? req?.socket?.remoteAddress;
    return typeof ip === "string" ? ip.slice(0, 45) : undefined;
  }
}
