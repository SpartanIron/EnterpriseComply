import { ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { db, orgEvidenceTable } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

/**
 * SECURITY - stored XSS (OWASP A03:2021).
 * `url` is operator-supplied and is rendered as an anchor href in the evidence
 * table. With no scheme allow-list, a `javascript:` or `data:text/html` URL
 * saved by one member runs in the browser of every other member of the org -
 * including the external auditors who are deliberately granted read access.
 * Only absolute http(s) URLs are stored; anything else is dropped.
 */
const EVIDENCE_URL_SCHEMES = new Set(["http:", "https:"]);

function safeEvidenceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  return EVIDENCE_URL_SCHEMES.has(parsed.protocol) ? parsed.toString() : null;
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\u0000/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

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
      // Retired artefacts stay in the table for the auditor but are not part
      // of the live compliance posture.
      where: and(
        eq(orgEvidenceTable.orgId, orgId),
        isNull(orgEvidenceTable.deletedAt),
      ),
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
        url: safeEvidenceUrl(body.url),
        filename: boundedText(body.filename, 512),
        mimeType: boundedText(body.mimeType, 255),
        uploadedBy: clerkUserId,
        collectedAt: new Date(collectedAt),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        metadata: { contentHash, algorithm: "sha256", lockedAt: collectedAt } as any,
      })
      .returning();

    // Evidence lifecycle events must be traceable (SOC 2 CC7.3 / NIST AU-2).
    await writeAuditLog(
      orgId,
      "evidence.created",
      "evidence",
      String(row.id),
      {
        title: row.title,
        ucoControlId: row.ucoControlId,
        source: row.source,
        contentHash,
      },
      clerkUserId,
    );

    return { ...row, contentHash };
  }

  async deleteEvidence(
    orgId: number,
    evidenceId: number,
    clerkUserId?: string,
    reason?: string,
  ) {
    // Snapshot before removal: a compliance artefact must never be able to
    // disappear without leaving a durable record in the append-only audit log.
    const existing = await db.query.orgEvidenceTable.findFirst({
      where: and(eq(orgEvidenceTable.orgId, orgId), eq(orgEvidenceTable.id, evidenceId)),
    });

    if (!existing) {
      return { success: false, reason: "not_found" as const };
    }

    // A record under legal hold cannot be retired at all.
    if (existing.legalHold) {
      await writeAuditLog(
        orgId,
        "evidence.delete_blocked_legal_hold",
        "evidence",
        String(evidenceId),
        { title: existing.title, reason: "legal_hold" },
        clerkUserId,
      );
      throw new ForbiddenException(
        "This evidence record is under legal hold and cannot be removed.",
      );
    }

    // Evidence is WORM at the database layer: enforce_evidence_worm() rejects
    // DELETE. Retirement is a retention state change, so the artefact and its
    // ledger entry survive for the full audit window.
    await db
      .update(orgEvidenceTable)
      .set({
        deletedAt: new Date(),
        deletedBy: clerkUserId ?? null,
        deletionReason: reason ?? "removed_by_user",
      })
      .where(and(eq(orgEvidenceTable.orgId, orgId), eq(orgEvidenceTable.id, evidenceId)));

    if (existing) {
      const meta = existing.metadata as Record<string, unknown> | null;
      await writeAuditLog(
        orgId,
        "evidence.retired",
        "evidence",
        String(evidenceId),
        {
          title: existing.title,
          ucoControlId: existing.ucoControlId,
          source: existing.source,
          collectedAt: existing.collectedAt,
          contentHash: meta?.contentHash ?? null,
        },
        clerkUserId,
      );
    }

    return { success: true, retired: true, hardDeleted: false };
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
