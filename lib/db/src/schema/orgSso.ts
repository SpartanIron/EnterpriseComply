import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// SSO / SAML configuration for an org's Identity Provider (IdP) connection.
//
// Field groups (mirrors the Settings UI sections):
// - Identity Provider selection + how it was configured (upload/url/manual)
// - Core SAML settings (entity id, SSO/SLO urls, cert, NameID format, signing requirements)
// - User provisioning (JIT, SCIM flag, disable-local-password-login flag)
// - Attribute mapping (which SAML attribute name carries each user field)
// - Authorization (samlGroupMappings, unchanged from the original P1-07 shape)
// - Security (clock skew tolerance, session lifetime, cert validity window)
export const orgSsoConfigTable = pgTable("org_sso_config", {
    id:             serial("id").primaryKey(),
    orgId:          integer("org_id").notNull().unique(),
    provider:       text("provider").notNull().default("saml"), // okta | azure_ad | google | ping | authentik | keycloak | saml
    domain:         text("domain"),                     // e.g. company.com
    enabled:        boolean("enabled").notNull().default(true),

    // ── Configuration method ──────────────────────────────────────────────
    // How the fields below were populated. "upload"/"url" both resolve to the
    // same stored fields via parseIdpMetadataXml() server-side; "manual" means
    // the admin typed the fields in directly. Stored for audit/UX purposes only
    // -- it does not change validation.
    configMethod:   text("config_method").notNull().default("manual"), // upload | url | manual
    metadataUrl:    text("metadata_url"),

    // ── Core SAML settings ──────────────────────────────────────────────────
    idpEntityId:    text("idp_entity_id").notNull(),
    idpSsoUrl:      text("idp_sso_url").notNull(),
    idpSloUrl:      text("idp_slo_url"),
    idpCertificate: text("idp_certificate").notNull(), // PEM
    nameIdFormat:   text("name_id_format").notNull().default("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"),
    requestedAuthnContext: text("requested_authn_context"), // null = unspecified (current behaviour)
    wantAssertionsSigned:     boolean("want_assertions_signed").notNull().default(true),
    wantAuthnResponseSigned:  boolean("want_authn_response_signed").notNull().default(false),

    // ── User provisioning ────────────────────────────────────────────────────
    // jitProvisioningEnabled reflects existing, already-live behaviour (SSO
    // logins upsert a user record on first sign-in) -- default true preserves
    // that. scimEnabled and disableLocalPasswordLogin are captured here so the
    // admin's intent is recorded even though the corresponding sync engine /
    // login-path enforcement are follow-up work -- see PR description.
    jitProvisioningEnabled:     boolean("jit_provisioning_enabled").notNull().default(true),
    scimEnabled:                boolean("scim_enabled").notNull().default(false),
    disableLocalPasswordLogin:  boolean("disable_local_password_login").notNull().default(false),

    // ── Attribute mapping ─────────────────────────────────────────────────────
    // Maps our field name -> the SAML attribute name the IdP sends it under.
    // Keys: email, firstName, lastName, displayName, groups, department.
    // Missing keys fall back to the existing hardcoded heuristics in sso.service.ts.
    attributeMapping: jsonb("attribute_mapping").$type<Record<string, string>>(),

    // ── Authorization ─────────────────────────────────────────────────────────
    samlGroupMappings: jsonb("saml_group_mappings").$type<Record<string, string>>(),

    // ── Security ───────────────────────────────────────────────────────────
    clockSkewToleranceMs:   integer("clock_skew_tolerance_ms").notNull().default(5000),
    sessionLifetimeMinutes: integer("session_lifetime_minutes").notNull().default(480), // 8h, matches prior hardcoded value
    // Parsed from idpCertificate at save time (Node's built-in X509Certificate) --
    // used to render the Certificate Expiration Monitoring panel. Null until the
    // first save happens under the new code path.
    certNotBefore: timestamp("cert_not_before", { withTimezone: true }),
    certNotAfter:  timestamp("cert_not_after", { withTimezone: true }),

    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgSsoConfig = typeof orgSsoConfigTable.$inferSelect;
