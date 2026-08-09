/**
 * saml-sp.ts — SAML Service Provider utilities for EnterpriseComply
 *
 * Provides:
 *  - getAppBaseUrl()   — canonical base URL used for entityId / ACS URLs
 *  - getSpEntityId()   — SP entity ID for an org slug
 *  - getAcsUrl()       — Assertion Consumer Service URL for an org slug
 *  - buildSamlInstance() — creates a configured @node-saml/node-saml instance
 *  - generateSpMetadataXml() — generates the SP metadata XML for admin to paste into IdP
 */

import { SAML } from "@node-saml/node-saml";

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
  idpCertificate: string; // PEM — strip headers for @node-saml if needed
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
    wantAssertionsSigned:     true,
    wantAuthnResponseSigned:  false,
    disableRequestedAuthnContext: true,
    identifierFormat:         "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    signatureAlgorithm:       "sha256",
    acceptedClockSkewMs:      5000,
    // Required fields with defaults
    additionalParams:              {},
    additionalAuthorizeParams:     {},
    allowCreate:                   true,
    racComparison:                 "exact",
    forceAuthn:                    false,
    passive:                       false,
    skipRequestCompression:        false,
    authnContext:                  ["urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified"],
    validateInResponseTo:          "never" as any,
    requestIdExpirationPeriodMs:   28800000,
    maxAssertionAgeMs:             28800000,
    signMetadata:                  false,
    disableRequestAcsUrl:          false,
    logoutUrl:                     "",
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
