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
    parseIdpMetadataXml,
    getCertValidity,
} from "../../lib/saml-sp.js";
import { guardedFetch } from "../../lib/guarded-fetch.js";

export interface SaveSsoConfigDto {
  provider: string;
    domain?: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificate: string;
    samlGroupMappings?: Record<string, string>;
    // Configuration method
    configMethod?: "upload" | "url" | "manual";
    metadataUrl?: string;
    // Core SAML settings
    idpSloUrl?: string;
    nameIdFormat?: string;
    requestedAuthnContext?: string;
    wantAssertionsSigned?: boolean;
    wantAuthnResponseSigned?: boolean;
    // User provisioning
    jitProvisioningEnabled?: boolean;
    scimEnabled?: boolean;
    disableLocalPasswordLogin?: boolean;
    // Attribute mapping (field name -> SAML attribute name)
    attributeMapping?: Record<string, string>;
    // Security
    clockSkewToleranceMs?: number;
    sessionLifetimeMinutes?: number;
}

// Fields extracted from an IdP metadata XML document, returned by the
// "Upload IdP Metadata XML" / "Metadata URL" configuration methods so the
// frontend can pre-fill the manual SAML settings fields. Provide either
// `xml` (file contents / pasted text) or `url` (fetched via the SSRF-guarded
// client), not both.
export interface ParseMetadataDto {
    xml?: string;
    url?: string;
}

const ROLE_HIERARCHY = ['member', 'compliance_manager', 'admin'];

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
            provider:          configRow.provider,
            domain:            configRow.domain,
            idpEntityId:       configRow.idpEntityId,
            idpSsoUrl:         configRow.idpSsoUrl,
            // Return partial cert (first 64 chars) — don't expose full cert for security UX;
            // the full cert is stored and used server-side only.
            idpCertificate:    configRow.idpCertificate,
            enabled:           configRow.enabled,
            samlGroupMappings: (configRow as any).samlGroupMappings ?? {},
                      configMethod: (configRow as any).configMethod ?? "manual",
                      metadataUrl: (configRow as any).metadataUrl ?? null,
                      idpSloUrl: (configRow as any).idpSloUrl ?? null,
                      nameIdFormat: (configRow as any).nameIdFormat ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                      requestedAuthnContext: (configRow as any).requestedAuthnContext ?? null,
                      wantAssertionsSigned: (configRow as any).wantAssertionsSigned ?? true,
                      wantAuthnResponseSigned: (configRow as any).wantAuthnResponseSigned ?? false,
                      jitProvisioningEnabled: (configRow as any).jitProvisioningEnabled ?? true,
                      scimEnabled: (configRow as any).scimEnabled ?? false,
                      disableLocalPasswordLogin: (configRow as any).disableLocalPasswordLogin ?? false,
                      attributeMapping: (configRow as any).attributeMapping ?? {},
                      clockSkewToleranceMs: (configRow as any).clockSkewToleranceMs ?? 5000,
                      sessionLifetimeMinutes: (configRow as any).sessionLifetimeMinutes ?? 480,
                      certNotBefore: (configRow as any).certNotBefore ?? null,
                      certNotAfter: (configRow as any).certNotAfter ?? null,
                      certExpiresInDays: (configRow as any).certNotAfter
                        ? Math.round((new Date((configRow as any).certNotAfter).getTime() - Date.now()) / 86400000)
                                      : null,
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

        // Cert Expiration Monitoring (Security section): parse the validity
        // window once at save time so the UI can show it without re-parsing the
        // PEM on every read.
        const certValidity = getCertValidity(dto.idpCertificate);

    await db
      .insert(orgSsoConfigTable)
      .values({
        orgId,
        provider:          dto.provider || "saml",
        domain:            dto.domain || null,
        idpEntityId:       dto.idpEntityId,
        idpSsoUrl:         dto.idpSsoUrl,
        idpCertificate:    dto.idpCertificate,
        enabled:           true,
        samlGroupMappings: dto.samlGroupMappings ?? null,
                configMethod: dto.configMethod || "manual",
                metadataUrl: dto.metadataUrl || null,
                idpSloUrl: dto.idpSloUrl || null,
                nameIdFormat: dto.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                requestedAuthnContext: dto.requestedAuthnContext || null,
                wantAssertionsSigned: dto.wantAssertionsSigned ?? true,
                wantAuthnResponseSigned: dto.wantAuthnResponseSigned ?? false,
                jitProvisioningEnabled: dto.jitProvisioningEnabled ?? true,
                scimEnabled: dto.scimEnabled ?? false,
                disableLocalPasswordLogin: dto.disableLocalPasswordLogin ?? false,
                attributeMapping: dto.attributeMapping ?? null,
                clockSkewToleranceMs: dto.clockSkewToleranceMs ?? 5000,
                sessionLifetimeMinutes: dto.sessionLifetimeMinutes ?? 480,
                certNotBefore: certValidity?.notBefore ?? null,
                certNotAfter: certValidity?.notAfter ?? null,
      } as any)
      .onConflictDoUpdate({
        target: orgSsoConfigTable.orgId,
        set: {
          provider:          dto.provider || "saml",
          domain:            dto.domain || null,
          idpEntityId:       dto.idpEntityId,
          idpSsoUrl:         dto.idpSsoUrl,
          idpCertificate:    dto.idpCertificate,
          enabled:           true,
          samlGroupMappings: dto.samlGroupMappings ?? null,
                  configMethod: dto.configMethod || "manual",
                  metadataUrl: dto.metadataUrl || null,
                  idpSloUrl: dto.idpSloUrl || null,
                  nameIdFormat: dto.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                  requestedAuthnContext: dto.requestedAuthnContext || null,
                  wantAssertionsSigned: dto.wantAssertionsSigned ?? true,
                  wantAuthnResponseSigned: dto.wantAuthnResponseSigned ?? false,
                  jitProvisioningEnabled: dto.jitProvisioningEnabled ?? true,
                  scimEnabled: dto.scimEnabled ?? false,
                  disableLocalPasswordLogin: dto.disableLocalPasswordLogin ?? false,
                  attributeMapping: dto.attributeMapping ?? null,
                  clockSkewToleranceMs: dto.clockSkewToleranceMs ?? 5000,
                  sessionLifetimeMinutes: dto.sessionLifetimeMinutes ?? 480,
                  certNotBefore: certValidity?.notBefore ?? null,
                  certNotAfter: certValidity?.notAfter ?? null,
          updatedAt:         new Date(),
        } as any,
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

    // -- Metadata parsing -- "Upload IdP Metadata XML" / "Metadata URL" --------
    // Does not save anything; returns extracted fields for the frontend to
    // pre-fill the manual SAML settings fields with, and lets the admin review
    // before clicking Save.
    async parseMetadata(dto: ParseMetadataDto) {
          if (!dto.xml && !dto.url) {
                  throw new BadRequestException("Provide either xml or url");
          }
          if (dto.xml && dto.url) {
                  throw new BadRequestException("Provide only one of xml or url, not both");
          }

          let xml = dto.xml ?? "";
          if (dto.url) {
                  try {
                            const res = await guardedFetch(dto.url);
                            if (!res.ok) {
                                        throw new BadRequestException(`Metadata URL returned HTTP ${res.status}`);
                            }
                            xml = await res.text();
                  } catch (err) {
                            logger.warn({ err, url: dto.url }, "[sso] metadata URL fetch failed");
                            throw new BadRequestException(
                                        "Could not fetch metadata from that URL. Check the URL is reachable over HTTPS and publicly resolvable.",
                                      );
                  }
          }

          const parsed = parseIdpMetadataXml(xml);
          if (!parsed.idpEntityId && !parsed.idpSsoUrl && !parsed.idpCertificate) {
                  throw new BadRequestException(
                            "Could not find EntityDescriptor / SingleSignOnService / X509Certificate in this metadata. Paste the fields in manually instead.",
                          );
          }

          return parsed;
    }

  // ── SAML auth flow ───────────────────────────────────────────────────────────

  async createLoginUrl(orgSlug: string): Promise<string> {
    const org = await this.getOrgBySlug(orgSlug);
    const config = await this.requireSsoConfig(org.id);

    const saml = buildSamlInstance(orgSlug, {
      idpEntityId:    config.idpEntityId,
      idpSsoUrl:      config.idpSsoUrl,
      idpCertificate: config.idpCertificate,
            idpSloUrl: (config as any).idpSloUrl,
            nameIdFormat: (config as any).nameIdFormat,
            requestedAuthnContext: (config as any).requestedAuthnContext,
            wantAssertionsSigned: (config as any).wantAssertionsSigned,
            wantAuthnResponseSigned: (config as any).wantAuthnResponseSigned,
            acceptedClockSkewMs: (config as any).clockSkewToleranceMs,
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
            idpSloUrl: (config as any).idpSloUrl,
            nameIdFormat: (config as any).nameIdFormat,
            requestedAuthnContext: (config as any).requestedAuthnContext,
            wantAssertionsSigned: (config as any).wantAssertionsSigned,
            wantAuthnResponseSigned: (config as any).wantAuthnResponseSigned,
            acceptedClockSkewMs: (config as any).clockSkewToleranceMs,
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

        // Attribute mapping (Attribute Mapping section): if the admin configured
        // a custom SAML attribute name for a field, look it up under that name
        // first; otherwise fall back to the pre-existing hardcoded heuristics so
        // orgs configured before this feature keep working unchanged.
        const attrMap = ((config as any).attributeMapping ?? {}) as Record<string, string>;
        const attr = (field: string): unknown =>
                attrMap[field] ? profile[attrMap[field]] : undefined;

        const email = (attr("email") ?? profile.email ?? profile.mail ?? profile.nameID) as string | undefined;
        if (!email || !email.includes("@")) {
                throw new BadRequestException("SAML assertion did not contain a valid email");
        }

        const firstName = attr("firstName") as string | undefined;
        const lastName = attr("lastName") as string | undefined;
        const name = (
                attr("displayName") ??
                profile.displayName ??
                (firstName && lastName ? `${firstName} ${lastName}` : undefined) ??
                profile.cn ??
                profile.name ??
                email.split("@")[0]
              ) as string;

        // department is captured for completeness but not yet persisted anywhere --
        // there is no org_people/user column for it on the SSO-provisioned path.
        const department = attr("department") as string | undefined;
        void department;

        // Extract IdP groups from SAML assertion attributes
        const rawGroups = (attr("groups") ?? profile.groups ?? profile.memberOf ??
                                 profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] ?? []) as string | string[];
        const groups: string[] = Array.isArray(rawGroups)
          ? rawGroups.map(String)
                : String(rawGroups).split(/[,;]+/).map(s => s.trim()).filter(Boolean);

    // Determine role from group mappings (config already loaded above)
    const groupMappings = ((config as any).samlGroupMappings ?? {}) as Record<string, string>;
    let assignedRole = 'member';
    for (const group of groups) {
      const mapped = groupMappings[group];
      if (mapped && ROLE_HIERARCHY.includes(mapped)) {
        const newIdx = ROLE_HIERARCHY.indexOf(mapped);
        const curIdx = ROLE_HIERARCHY.indexOf(assignedRole);
        if (newIdx > curIdx) assignedRole = mapped; // take highest role from all groups
      }
    }

    // Upsert user + session
    const { signedToken, expiresAt } = await this.upsertUserAndSession(
      email,
      name,
      org.id,
      ipAddress,
      userAgent,
      assignedRole,
            (config as any).sessionLifetimeMinutes ?? 480,
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
    role: string = 'member',
        sessionLifetimeMinutes: number = 480,
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

      // 2. Ensure org membership — INSERT only if not already a member; upgrade role if higher
      const PROTECTED_ROLES = ['owner', 'super_admin'];
      const existingMember = await client.query(
        `SELECT id, role FROM org_members WHERE org_id = $1 AND clerk_user_id = $2 LIMIT 1`,
        [orgId, actualUserId],
      );
      if (existingMember.rows.length === 0) {
        await client.query(
          `INSERT INTO org_members (org_id, clerk_user_id, email, role, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [orgId, actualUserId, email, role],
        );
      } else {
        const curRole = existingMember.rows[0].role as string;
        if (
          !PROTECTED_ROLES.includes(curRole) &&
          ROLE_HIERARCHY.indexOf(role) > ROLE_HIERARCHY.indexOf(curRole)
        ) {
          await client.query(
            `UPDATE org_members SET role = $1 WHERE org_id = $2 AND clerk_user_id = $3`,
            [role, orgId, actualUserId],
          );
        }
      }

      // 3. Create session
      const token      = randomBytes(32).toString("hex");
      const sessionId  = randomBytes(16).toString("hex");
          const expiresAt = new Date(Date.now() + sessionLifetimeMinutes * 60 * 1000); // Security section: Session Lifetime, default 8h

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
