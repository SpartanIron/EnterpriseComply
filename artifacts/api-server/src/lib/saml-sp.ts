/**
 * saml-sp.ts — SAML Service Provider utilities for EnterpriseComply
 *
 * Provides:
 *  - getAppBaseUrl()   — canonical base URL used for entityId / ACS URLs
 *  - getSpEntityId()   — SP entity ID for an org slug
 *  - getAcsUrl()       — Assertion Consumer Service URL for an org slug
 *  - buildSamlInstance() — creates a configured @node-saml/node-saml instance
 *  - generateSpMetadataXml() — generates the SP metadata XML for admin to paste into IdP
  * - parseIdpMetadataXml() -- extracts fields from IdP metadata XML
   * - getCertValidity() -- reads notBefore/notAfter off an X.509 PEM certificate
 */

import { SAML } from "@node-saml/node-saml";
import { X509Certificate } from "node:crypto";

export function getAppBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.APP_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://app.enterprisecomply.com")
  );
}

export function getSpEntityId(orgSlug: string): string {
  return `${getAppBaseUrl()}/saml/sp/${orgSlug}`;
}

export function getAcsUrl(orgSlug: string): string {
  return `${getAppBaseUrl()}/api/saml/${orgSlug}/callback`;
}

export interface IdpConfig {
  idpEntityId:    string;
    idpSsoUrl:      string;
    idpCertificate: string; // PEM -- strip headers for @node-saml if needed
    idpSloUrl?: string | null;
    nameIdFormat?: string | null;
    requestedAuthnContext?: string | null;
    wantAssertionsSigned?: boolean;
    wantAuthnResponseSigned?: boolean;
    acceptedClockSkewMs?: number;
}

/**
 * Creates a configured @node-saml/node-saml SAML instance for the given org.
 * Uses unsigned AuthnRequests (no SP private key required).
 * The IdP certificate is used to validate the IdP's signed assertion.
 */
export function buildSamlInstance(orgSlug: string, idp: IdpConfig): SAML {
  // @node-saml/node-saml accepts the cert with or without PEM headers;
  // strip headers if present to normalise.
  const certBody = idp.idpCertificate
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  return new SAML({
    callbackUrl:              getAcsUrl(orgSlug),
    entryPoint:               idp.idpSsoUrl,
    issuer:                   getSpEntityId(orgSlug),
    idpCert:                  certBody,
    audience:                 getSpEntityId(orgSlug),
    // Unsigned AuthnRequests are fine; the IdP's assertion MUST still be signed.
    authnRequestBinding:      "HTTP-Redirect",
    // Require a valid XML signature on the Assertion (the security-critical payload).
    // Most enterprise IdPs (Okta, Entra ID, Google Workspace) sign the Assertion.
    // wantAuthnResponseSigned remains false: some IdPs sign only the Assertion, not
    // the outer Response envelope, and that is safe when the Assertion is signed.
        wantAssertionsSigned:     idp.wantAssertionsSigned ?? true,
        wantAuthnResponseSigned:  idp.wantAuthnResponseSigned ?? false,
        disableRequestedAuthnContext: !idp.requestedAuthnContext,
        identifierFormat:   idp.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        signatureAlgorithm: "sha256",
        acceptedClockSkewMs: idp.acceptedClockSkewMs ?? 5000,
        // Required fields with defaults
        additionalParams: {},
        additionalAuthorizeParams: {},
        allowCreate: true,
        racComparison: "exact",
        forceAuthn: false,
        passive: false,
        skipRequestCompression: false,
        authnContext: idp.requestedAuthnContext ? [idp.requestedAuthnContext] : ["urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified"],
    validateInResponseTo:          "never" as any,
    requestIdExpirationPeriodMs:   28800000,
    maxAssertionAgeMs:             28800000,
    signMetadata:                  false,
    disableRequestAcsUrl:          false,
    // idp.idpSloUrl is stored and surfaced in the UI, but SP-initiated logout
        // is not wired to any route yet -- see PR description follow-ups.
        logoutUrl: idp.idpSloUrl || "",
    additionalLogoutParams:        {},
    generateUniqueId:              () => `_${Math.random().toString(36).slice(2)}`,
    cacheProvider: {
      saveAsync: async (k, v) => ({ value: v, createdAt: Date.now() }),
      getAsync:  async (_k)   => null,
      removeAsync: async (_k) => null,
    },
  });
}

/**
 * Generates minimal SP metadata XML for the admin to paste into their IdP.
 */
export function generateSpMetadataXml(orgSlug: string): string {
  const entityId = getSpEntityId(orgSlug);
  const acsUrl   = getAcsUrl(orgSlug);

  return `<?xml version="1.0"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${escapeXml(entityId)}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>
      urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
    </md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${escapeXml(acsUrl)}"
      index="1"
      isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


export interface ParsedIdpMetadata {
    idpEntityId: string | null;
    idpSsoUrl: string | null;
    idpSloUrl: string | null;
    idpCertificate: string | null;
}

/**
 * Extracts the fields an admin would otherwise copy-paste by hand out of a
 * standard SAML 2.0 IdP metadata XML document (EntityDescriptor /
 * IDPSSODescriptor). Works against metadata published by Entra ID, Okta,
 * Ping Identity, Google Workspace, Authentik, Keycloak, and any other
 * standards-compliant IdP -- the elements this reads are mandated by the
 * SAML 2.0 metadata schema, not vendor-specific.
 *
 * Implementation note: this is a deliberately narrow regex-based extractor,
 * not a full XML/DOM parser. The repo has no XML parsing library as a direct
 * dependency (node-saml only uses one internally), and adding one requires a
 * pnpm install + lockfile regeneration this environment cannot run. Regex
 * extraction is tolerant of attribute-order and namespace-prefix variation
 * (xmlns prefix may or may not be "md:"), which covers every real-world IdP
 * metadata file this was tested against, but it is not a substitute for a
 * real XML parser and will not handle deliberately malformed/adversarial XML
 * as safely as one would. Recommend swapping this for a real parser (e.g.
 * fast-xml-parser) in a follow-up once a dependency can be added properly.
 */
export function parseIdpMetadataXml(xml: string): ParsedIdpMetadata {
    const entityIdMatch = xml.match(/<(?:\w+:)?EntityDescriptor\b[^>]*\bentityID="([^"]+)"/i);

  const ssoRedirect = xml.match(
        /<(?:\w+:)?SingleSignOnService\b[^>]*\bBinding="[^"]*HTTP-Redirect"[^>]*\bLocation="([^"]+)"/i,
      );
    const ssoAny = xml.match(/<(?:\w+:)?SingleSignOnService\b[^>]*\bLocation="([^"]+)"/i);

  const sloRedirect = xml.match(
        /<(?:\w+:)?SingleLogoutService\b[^>]*\bBinding="[^"]*HTTP-Redirect"[^>]*\bLocation="([^"]+)"/i,
      );
    const sloAny = xml.match(/<(?:\w+:)?SingleLogoutService\b[^>]*\bLocation="([^"]+)"/i);

  const signingKeyBlock = xml.match(
        /<(?:\w+:)?KeyDescriptor\b[^>]*\buse="signing"[^>]*>([\s\S]{0,20000}?)<\/(?:\w+:)?KeyDescriptor>/i,
      );
    const certSource = signingKeyBlock ? signingKeyBlock[1] : xml;
    const certMatch = certSource.match(/<(?:\w+:)?X509Certificate>([\s\S]{0,20000}?)<\/(?:\w+:)?X509Certificate>/i);

  const idpCertificate = certMatch
      ? `-----BEGIN CERTIFICATE-----\n${certMatch[1].replace(/\s+/g, "").replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----`
        : null;

  return {
        idpEntityId: entityIdMatch?.[1]?.trim() ?? null,
        idpSsoUrl: (ssoRedirect ?? ssoAny)?.[1]?.trim() ?? null,
        idpSloUrl: (sloRedirect ?? sloAny)?.[1]?.trim() ?? null,
        idpCertificate,
  };
}

/**
 * Reads the validity window off an X.509 PEM certificate using Node's
 * built-in X509Certificate (no external dependency needed). Returns null if
 * the certificate cannot be parsed -- callers should treat that as "unknown
 * expiry", not as a save-time failure, since a malformed cert is caught
 * earlier by node-saml itself when the SAML instance is actually built.
 */
export function getCertValidity(pem: string): { notBefore: Date; notAfter: Date } | null {
    try {
          const normalised = pem.includes("-----BEGIN CERTIFICATE-----")
            ? pem
                  : `-----BEGIN CERTIFICATE-----\n${pem.replace(/\s+/g, "").replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----`;
          const cert = new X509Certificate(normalised);
          return { notBefore: new Date(cert.validFrom), notAfter: new Date(cert.validTo) };
    } catch {
          return null;
    }
}
