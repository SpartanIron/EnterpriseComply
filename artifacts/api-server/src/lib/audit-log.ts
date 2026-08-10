import { Logger } from "@nestjs/common";
import { db, orgAuditLogTable } from "@workspace/db";

const auditLogger = new Logger("AuditLog");

export async function writeAuditLog(
  orgId: number,
  action: string,
  resource: string,
  resourceId?: string | null,
  details?: unknown,
  actorId?: string,
  actorEmail?: string,
): Promise<void> {
  try {
    await db.insert(orgAuditLogTable).values({
      orgId,
      action,
      resource,
      resourceId: resourceId ?? undefined,
      details: details ?? undefined,
      actorId: actorId ?? undefined,
      actorEmail: actorEmail ?? undefined,
    });
  } catch (err) {
    // An audit write must never block the operation it is recording, but a
    // silent failure would leave a compliance gap - make it loud instead.
    auditLogger.error(
      `Failed to record audit entry "${action}" on ${resource} for org ${orgId}: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
}
