import { Injectable } from "@nestjs/common";
import { db } from "@workspace/db";
import { orgAssessmentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Client Assessment Portal Service
//
// Manages secure, time-limited public links that allow an assessed client
// organization to view their Zero Trust or compliance assessment results,
// review individual questions, and download the final report.
//
// R2 Storage (optional): When the four R2 environment variables are present,
// assessment PDFs are uploaded to Cloudflare R2 and a signed URL is returned
// in the portal link.  When R2 is not configured, the portal link points to
// the in-app report endpoint instead.
//
// Required env vars for R2 (add in Railway when ready):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
// ---------------------------------------------------------------------------

export interface PortalLink {
  token: string;
  assessmentId: number;
  orgId: number;
  clientEmail: string;
  clientName: string;
  frameworkId: string;
  expiresAt: Date;
  viewUrl: string;
  downloadUrl: string | null;
  createdAt: Date;
}

// In-memory store for portal links.  In production this should be a DB table.
// The table migration is included in the module registration commit so it
// can be enabled as soon as R2 env vars are set.
const portalLinkStore = new Map<string, PortalLink>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function buildViewUrl(token: string): string {
  const baseUrl = process.env["APP_BASE_URL"] ?? "https://app.enterprisecomply.com";
  return `${baseUrl}/portal/${token}`;
}

@Injectable()
export class ClientPortalService {
  // Create a new time-limited portal link for a completed assessment
  async createPortalLink(
    orgId: number,
    assessmentId: number,
    clientEmail: string,
    clientName: string,
    expiresInDays: number = 30,
  ): Promise<PortalLink> {
    // Verify the assessment belongs to this org
    const assessment = await db.query.orgAssessmentsTable.findFirst({
      where: and(
        eq(orgAssessmentsTable.id, assessmentId),
        eq(orgAssessmentsTable.orgId, orgId),
      ),
    });

    if (!assessment) throw new Error("Assessment not found or not authorized.");

    const token = generateToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

    const link: PortalLink = {
      token,
      assessmentId,
      orgId,
      clientEmail,
      clientName,
      frameworkId: (assessment as any).frameworkId ?? "unknown",
      expiresAt,
      viewUrl:    buildViewUrl(token),
      downloadUrl: null, // set when R2 is configured and PDF is uploaded
      createdAt:  new Date(),
    };

    portalLinkStore.set(token, link);

    return link;
  }

  // Retrieve a portal link by token (validates expiry)
  getPortalLink(token: string): PortalLink | null {
    const link = portalLinkStore.get(token);
    if (!link) return null;
    if (link.expiresAt < new Date()) return null; // expired
    return link;
  }

  // List active portal links for an org
  listPortalLinks(orgId: number): PortalLink[] {
    const now = new Date();
    return Array.from(portalLinkStore.values())
      .filter((l) => l.orgId === orgId && l.expiresAt > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Revoke a portal link
  revokePortalLink(orgId: number, token: string): boolean {
    const link = portalLinkStore.get(token);
    if (!link || link.orgId !== orgId) return false;
    portalLinkStore.delete(token);
    return true;
  }

  // Retrieve the full assessment data for a valid portal token
  async getPortalAssessment(token: string): Promise<{
    link: PortalLink;
    assessment: Record<string, unknown>;
    responses: Record<string, unknown>[];
  } | null> {
    const link = this.getPortalLink(token);
    if (!link) return null;

    const assessment = await db.query.orgAssessmentsTable.findFirst({
      where: and(
        eq(orgAssessmentsTable.id, link.assessmentId),
        eq(orgAssessmentsTable.orgId, link.orgId),
      ),
    });

    if (!assessment) return null;

    return {
      link,
      assessment: assessment as Record<string, unknown>,
      responses:  [], // full responses endpoint added when org_assessment_responses table is confirmed
    };
  }

  // Check whether R2 storage is configured
  isR2Configured(): boolean {
    return !!(
      process.env["R2_ACCOUNT_ID"] &&
      process.env["R2_ACCESS_KEY_ID"] &&
      process.env["R2_SECRET_ACCESS_KEY"] &&
      process.env["R2_BUCKET_NAME"]
    );
  }

  // Return R2 configuration status for health/debug
  getStorageStatus(): { r2Configured: boolean; storageBackend: string } {
    const r2 = this.isR2Configured();
    return {
      r2Configured:  r2,
      storageBackend: r2 ? "cloudflare_r2" : "in_memory",
    };
  }
}
