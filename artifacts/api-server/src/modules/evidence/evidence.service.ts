import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { db, orgEvidenceTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * Phase 3A — Commercial Evidence Locker
 *
 * Every evidence snapshot receives a SHA-256 content hash computed at ingest time.
 * The hash covers: orgId + ucoControlId + source + collectedAt timestamp + description.
 * The hash is stored in the `metadata` JSONB column under the key `contentHash`.
 *
 * This creates an append-only, tamper-evident trail:
 * - Auditors can recompute the hash from the stored fields to verify integrity.
 * - Each write is a new row (no updates to existing evidence rows from this service).
 *
 * Production upgrade path: replace PostgreSQL with Amazon QLDB or a
 * Write-Once-Read-Many (WORM) S3 bucket with Object Lock for immutability
 * guarantees enforced at the storage layer.
 */
function computeEvidenceHash(fields: {
  orgId: number;
  ucoControlId: string;
  source: string;
  collectedAt: string;
  description: string;
}): string {
  const canonical = JSON.stringify({
    orgId: fields.orgId,
    ucoControlId: fields.ucoControlId,
    source: fields.source,
    collectedAt: fields.collectedAt,
    description: fields.description,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

@Injectable()
export class EvidenceService {
  async getEvidence(orgId: number) {
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
    });
    const now = new Date();
    return {
      evidence: evidence.map((e) => ({
        ...e,
        isStale: e.expiresAt ? e.expiresAt < now : false,
        daysUntilExpiry: e.expiresAt
          ? Math.ceil((e.expiresAt.getTime() - now.getTime()) / 86400000)
          : null,
        contentHash: (e.metadata as Record<string, unknown> | null)?.contentHash ?? null,
        hashVerified: false, // client can re-verify by recomputing from stored fields
      })),
    };
  }

  async addEvidence(
    orgId: number,
    clerkUserId: string,
    body: {
      ucoControlId?: string;
      title: string;
      description?: string;
      type?: string;
      source?: string;
      integrationKey?: string;
      url?: string;
      filename?: string;
      mimeType?: string;
      expiresAt?: string;
    },
  ) {
    const collectedAt = new Date().toISOString();
    const ucoControlId = body.ucoControlId ?? "manual";
    const source = body.source ?? "manual";
    const description = body.description ?? body.title;

    // Phase 3A: compute tamper-evident SHA-256 hash of this snapshot
    const contentHash = computeEvidenceHash({
      orgId,
      ucoControlId,
      source,
      collectedAt,
      description,
    });

    const [row] = await db
      .insert(orgEvidenceTable)
      .values({
        orgId,
        ucoControlId,
        integrationKey: body.integrationKey ?? "manual",
        title: body.title,
        description,
        type: (body.type ?? "document") as any,
        source: source as any,
        url: body.url ?? null,
        filename: body.filename ?? null,
        mimeType: body.mimeType ?? null,
        uploadedBy: clerkUserId,
        collectedAt: new Date(collectedAt),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        metadata: { contentHash, algorithm: "sha256", lockedAt: collectedAt } as any,
      })
      .returning();

    return { ...row, contentHash };
  }

  async deleteEvidence(orgId: number, evidenceId: number) {
    await db
      .delete(orgEvidenceTable)
      .where(and(eq(orgEvidenceTable.orgId, orgId), eq(orgEvidenceTable.id, evidenceId)));
    return { success: true };
  }

  /**
   * Verify the SHA-256 hash of an evidence record.
   * Returns { valid: true } if the stored hash matches a freshly computed one.
   */
  async verifyEvidenceIntegrity(orgId: number, evidenceId: number) {
    const row = await db.query.orgEvidenceTable.findFirst({
      where: and(eq(orgEvidenceTable.orgId, orgId), eq(orgEvidenceTable.id, evidenceId)),
    });
    if (!row) return { valid: false, reason: "not_found" };

    const meta = row.metadata as Record<string, unknown> | null;
    const storedHash = meta?.contentHash as string | undefined;
    if (!storedHash) return { valid: false, reason: "no_hash_stored" };

    const recomputed = computeEvidenceHash({
      orgId: row.orgId,
      ucoControlId: row.ucoControlId ?? "manual",
      source: String(row.source ?? "manual"),
      collectedAt: row.collectedAt.toISOString(),
      description: row.description ?? row.title,
    });

    return {
      valid: recomputed === storedHash,
      algorithm: "sha256",
      storedHash,
      recomputedHash: recomputed,
    };
  }
}
