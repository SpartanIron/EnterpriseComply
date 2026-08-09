import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { db, pool, organizationsTable, orgSsoConfigTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createHmac, randomBytes } from "crypto";
import { logger } from "../../lib/logger.js";
import {
  buildSamlInstance,
  generateSpMetadataXml,
  getAcsUrl,
  getSpEntityId,
} from "../../lib/saml-sp.js";

export interface SaveSsoConfigDto {
  provider:       string;
  domain?:        string;
  idpEntityId:    string;
  idpSsoUrl:      string;
  idpCertificate: string;
}

@Injectable()
export class SsoService {
  // ── SP metadata ─────────────────────────────────────────────────────────────

  async getSpMetadata(orgId: number): Promise<string> {
    const org = await this.getOrg(orgId);
    return generateSpMetadataXml(org.slug);
  }

  // ── SSO config CRUD ─────────────────────────────────────────────────────────

  async getSsoConfig(orgId: number) {
    const [org, configRow] = await Promise.all([
      this.getOrg(orgId),
      db.query.orgSsoConfigTable.findFirst({
        where: eq(orgSsoConfigTable.orgId, orgId),
      }),
    ]);

    const entityId = getSpEntityId(org.slug);
    const acsUrl   = getAcsUrl(org.slug);

    return {
      configured: !!configRow,
      config: configRow
        ? {
            provider:    configRow.provider,
            domain:      configRow.domain,
            idpEntityId: configRow.idpEntityId,
            idpSsoUrl:   configRow.idpSsoUrl,
            // Return partial cert (first 64 chars) — don't expose full cert for security UX;
            // the full cert is stored and used server-side only.
            idpCertificate: configRow.idpCertificate,
            enabled:     configRow.enabled,
          }
        : null,
      sp: { entityId, acsUrl },
    };
  }

  async saveSsoConfig(orgId: number, dto: SaveSsoConfigDto) {
    if (!dto.idpEntityId || !dto.idpSsoUrl || !dto.idpCertificate) {
      throw new BadRequestException("idpEntityId, idpSsoUrl, and idpCertificate are required");
    }

    // Basic URL validation
    try { new URL(dto.idpSsoUrl); } catch {
      throw new BadRequestException("idpSsoUrl must be a valid URL");
    }

    await db
      .insert(orgSsoConfigTable)
      .values({
        orgId,
        provider:       dto.provider || "saml",
        domain:         dto.domain || null,
        idpEntityId:    dto.idpEntityId,
        idpSsoUrl:      dto.idpSsoUrl,
        idpCertificate: dto.idpCertificate,
        enabled:        true,
      })
      .onConflictDoUpdate({
        target: orgSsoConfigTable.orgId,
        set: {
          provider:       dto.provider || "saml",
          domain:         dto.domain || null,
          idpEntityId:    dto.idpEntityId,
          idpSsoUrl:      dto.idpSsoUrl,
          idpCertificate: dto.idpCertificate,
          enabled:        true,
          updatedAt:      new Date(),
        },
      });

    // Also update sso_enabled / sso_provider / sso_domain on the organizations row.
    // These columns are added via ALTER TABLE (not in the Drizzle schema definition),
    // so we use a raw SQL query.
    await db.execute(
      sql.raw(
        `UPDATE organizations SET sso_enabled = TRUE, sso_provider = '${(dto.provider || "saml").replace(/'/g, "''")}', sso_domain = ${dto.domain ? `'${dto.domain.replace(/'/g, "''")}'` : "NULL"} WHERE id = ${orgId}`,
      ),
    );

    logger.info({ orgId, provider: dto.provider }, "[sso] SSO config saved");
    return { ok: true };
  }

  // ── SAML auth flow ───────────────────────────────────────────────────────────

  async createLoginUrl(orgSlug: string): Promise<string> {
    const org = await this.getOrgBySlug(orgSlug);
    const config = await this.requireSsoConfig(org.id);

    const saml = buildSamlInstance(orgSlug, {
      idpEntityId:    config.idpEntityId,
      idpSsoUrl:      config.idpSsoUrl,
      idpCertificate: config.idpCertificate,
    });

    const url = await saml.getAuthorizeUrlAsync("", undefined, {});
    return url;
  }

  async handleCallback(
    orgSlug: string,
    body: Record<string, string>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ signedToken: string; expiresAt: Date }> {
    const org = await this.getOrgBySlug(orgSlug);
    const config = await this.requireSsoConfig(org.id);

    const saml = buildSamlInstance(orgSlug, {
      idpEntityId:    config.idpEntityId,
      idpSsoUrl:      config.idpSsoUrl,
      idpCertificate: config.idpCertificate,
    });

    let profile: Record<string, unknown>;
    try {
      const result = await saml.validatePostResponseAsync(body);
      if (!result.profile) throw new Error("No profile in SAML assertion");
      profile = result.profile as unknown as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err, orgSlug }, "[sso] SAML assertion validation failed");
      throw new BadRequestException("SAML assertion validation failed");
    }

    const email = (profile.email || profile.mail || profile.nameID) as string | undefined;
    if (!email || !email.includes("@")) {
      throw new BadRequestException("SAML assertion did not contain a valid email");
    }

    const name = (profile.displayName || profile.cn || profile.name || email.split("@")[0]) as string;

    // Upsert user + session
    const { signedToken, expiresAt } = await this.upsertUserAndSession(
      email,
      name,
      org.id,
      ipAddress,
      userAgent,
    );

    logger.info({ email, orgSlug }, "[sso] SAML login successful");
    return { signedToken, expiresAt };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async getOrg(orgId: number) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  private async getOrgBySlug(slug: string) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.slug, slug),
    });
    if (!org) throw new NotFoundException(`Organization '${slug}' not found`);
    return org;
  }

  private async requireSsoConfig(orgId: number) {
    const config = await db.query.orgSsoConfigTable.findFirst({
      where: eq(orgSsoConfigTable.orgId, orgId),
    });
    if (!config || !config.enabled) {
      throw new BadRequestException("SSO is not configured for this organization");
    }
    return config;
  }

  /**
   * Upserts a user in BetterAuth's user table, ensures org membership,
   * creates a session, signs the session token, and returns it.
   */
  private async upsertUserAndSession(
    email: string,
    name:  string,
    orgId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ signedToken: string; expiresAt: Date }> {
    const client = await pool.connect();
    try {
      // 1. Upsert user
      const userId = randomBytes(16).toString("hex");
      await client.query(
        `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, TRUE, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW()`,
        [userId, name, email],
      );

      // Get the actual user id (may differ if email already existed)
      const userRow = await client.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [email],
      );
      const actualUserId: string = userRow.rows[0].id;

      // 2. Ensure org membership — INSERT only if not already a member
      const existingMember = await client.query(
        `SELECT id FROM org_members WHERE org_id = $1 AND clerk_user_id = $2 LIMIT 1`,
        [orgId, actualUserId],
      );
      if (existingMember.rows.length === 0) {
        await client.query(
          `INSERT INTO org_members (org_id, clerk_user_id, email, role, created_at)
           VALUES ($1, $2, $3, 'member', NOW())`,
          [orgId, actualUserId, email],
        );
      }

      // 3. Create session
      const token      = randomBytes(32).toString("hex");
      const sessionId  = randomBytes(16).toString("hex");
      const expiresAt  = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

      await client.query(
        `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
         VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)`,
        [sessionId, expiresAt, token, ipAddress ?? null, userAgent ?? null, actualUserId],
      );

      // 4. Sign the token (same format as BetterAuth's cookie verifier)
      const secret = process.env.BETTER_AUTH_SECRET ?? "ec-dev-secret-change-in-production";
      const sig = createHmac("sha256", secret).update(token).digest();
      const signedToken = `${token}.${Buffer.from(sig).toString("base64")}`;

      return { signedToken, expiresAt };
    } finally {
      client.release();
    }
  }
}
