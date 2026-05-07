import { db, orgAuditLogTable } from "@workspace/db";

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
  } catch {
    // Audit log writes are best-effort - never block main operations
  }
}
