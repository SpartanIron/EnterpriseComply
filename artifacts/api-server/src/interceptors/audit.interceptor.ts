import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { writeAuditLog, writeSecurityEvent } from "../lib/audit-log.js";

/**
 * Global audit interceptor.
 *
 * Before this existed, only 8 of the platform's 40+ modules wrote audit
 * entries, which meant the audit trail could not answer "who changed this"
 * for most of the product. Auditing per-service does not scale and silently
 * regresses every time someone adds a controller, so coverage is enforced
 * here instead: every state-changing request is recorded centrally, and
 * services remain free to write richer, domain-specific entries on top.
 *
 * Design rules:
 *  - never block or fail a request because of an audit write
 *  - never record request bodies (they carry credentials and customer data)
 *  - reads are only recorded for sensitive surfaces, otherwise the trail
 *    becomes noise and the retention cost explodes
 *
 * NIST AU-2 (auditable events), AU-3 (content), AU-12 (generation).
 * CMMC AU.L2-3.3.1 / AU.L2-3.3.2. SOC 2 CC7.2.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Read paths that are themselves security-relevant and must be recorded. */
const SENSITIVE_READS = [
  /\/audit-?logs?/i,
  /\/ledger\/export/i,
  /\/db-security/i,
  /\/audit-retention/i,
  /\/credentials/i,
  /\/sso\/config/i,
  /\/rate-limits/i,
  /\/admin\//i,
  /\/export/i,
  /\/audit-package/i,
];

/** Paths that would flood the trail with no forensic value. */
const IGNORED = [/\/health/i, /\/healthz/i, /\/public\//i, /\/internal\/status/i];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();

    const req = context.switchToHttp().getRequest();
    const started = Date.now();
    const method: string = req?.method ?? "GET";
    const path: string = req?.originalUrl ?? req?.url ?? "";

    if (IGNORED.some((r) => r.test(path))) return next.handle();

    const isMutation = MUTATING.has(method);
    const isSensitiveRead = !isMutation && SENSITIVE_READS.some((r) => r.test(path));
    if (!isMutation && !isSensitiveRead) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => void this.record(req, method, path, started, null),
        error: (err) => void this.record(req, method, path, started, err),
      }),
    );
  }

  private async record(
    req: any,
    method: string,
    path: string,
    started: number,
    err: unknown,
  ): Promise<void> {
    try {
      const orgId = this.resolveOrgId(req);
      const status = this.resolveStatus(err);
      const { resource, resourceId } = this.resolveResource(path);
      const actorId: string | undefined = req?.clerkUserId ?? undefined;
      const actorEmail: string | undefined =
        req?.member?.email ?? req?.user?.email ?? undefined;
      const ip = this.resolveIp(req);

      const details = {
        method,
        // query strings can carry filters but never secrets on this API;
        // the path is stored without them to be safe
        path: path.split("?")[0],
        status,
        durationMs: Date.now() - started,
        source: "http",
      };

      // An authorisation failure is a security event first and an audit
      // entry second - it is the signal a tenant boundary was probed.
      if (status === 401 || status === 403) {
        if (orgId === null) return;
        await writeSecurityEvent(
          orgId,
          status === 401 ? "unauthenticated_request" : "authorization_denied",
          resource,
          details,
          actorId,
          actorEmail,
          ip,
        );
        return;
      }

      if (orgId === null) return;

      const action =
        resource + "." + method.toLowerCase() + (err ? ".failed" : "");

      await writeAuditLog(
        orgId,
        action,
        resource,
        resourceId,
        details,
        actorId,
        actorEmail,
        ip,
      );
    } catch (e) {
      this.logger.warn(
        "audit interceptor could not record " + method + " " + path + ": " +
          ((e as any)?.message ?? String(e)),
      );
    }
  }

  private resolveOrgId(req: any): number | null {
    const fromCtx = Number(req?.orgId);
    if (Number.isInteger(fromCtx) && fromCtx > 0) return fromCtx;
    const fromParam = Number(req?.params?.orgId);
    if (Number.isInteger(fromParam) && fromParam > 0) return fromParam;
    return null;
  }

  private resolveStatus(err: unknown): number {
    if (!err) return 200;
    const s = (err as any)?.status ?? (err as any)?.statusCode;
    return Number.isInteger(s) ? s : 500;
  }

  /** "/api/orgs/12/evidence/98" -> { resource: "evidence", resourceId: "98" } */
  private resolveResource(path: string): { resource: string; resourceId: string | null } {
    const clean = path.split("?")[0].replace(/^\/api\//, "");
    const parts = clean.split("/").filter(Boolean);
    const orgsIdx = parts.indexOf("orgs");
    const scoped = orgsIdx >= 0 ? parts.slice(orgsIdx + 2) : parts;
    const resource = scoped[0] ?? parts[0] ?? "unknown";
    const tail = scoped[scoped.length - 1];
    const resourceId = tail && tail !== resource && /^[\w.-]{1,64}$/.test(tail) ? tail : null;
    return { resource, resourceId };
  }

  private resolveIp(req: any): string | undefined {
    const cf = req?.headers?.["cf-connecting-ip"];
    if (typeof cf === "string" && cf) return cf.slice(0, 45);
    const xff = req?.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff) return xff.split(",")[0].trim().slice(0, 45);
    const ip = req?.ip ?? req?.socket?.remoteAddress;
    return typeof ip === "string" ? ip.slice(0, 45) : undefined;
  }
}
