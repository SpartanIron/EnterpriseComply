/**
 * google-jwt.ts
 *
 * Builds the RS256-signed JWT assertion that a Google service account uses to
 * obtain an OAuth 2.0 access token.
 *
 * Why this file exists: the previous Google Workspace provider assembled the
 * assertion as `${header}.${claim}.signature` - the literal seven-character
 * string "signature" where the signature belongs - and encoded the two halves
 * with btoa() instead of base64url. It carried a comment saying "In production,
 * sign with RSA private key. Here we simulate the API call structure." That
 * request can never succeed at Google's token endpoint, so the connector
 * offered a Connect button that was guaranteed to fail in a way a customer
 * would read as their own mistake.
 *
 * Shape verified against Google's own documentation, "Using OAuth 2.0 for
 * Server to Server Applications":
 *
 *   JWT             = {Base64url header}.{Base64url claim set}.{Base64url signature}
 *   signing input   = {Base64url header}.{Base64url claim set}
 *   header          = alg RS256 (only permitted value), typ JWT, optional kid
 *   required claims = iss, scope, aud, exp, iat
 *   sub             = the user being impersonated, for domain-wide delegation
 *   token request   = POST https://oauth2.googleapis.com/token, form encoded,
 *                     grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
 *
 * RS256 is RSASSA-PKCS1-v1_5 with SHA-256, which is node crypto's
 * "RSA-SHA256". No dependency is added: node ships everything needed.
 *
 * This module is deliberately pure. It performs no network I/O, which is what
 * makes it testable without a Google account - scripts/google-jwt.test.ts
 * generates a throwaway RSA keypair, signs an assertion, and verifies the
 * signature with the matching public key.
 */

import { createSign } from "crypto";

/** Google's token endpoint. Not configurable: it is not a tenant-supplied URL. */
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** The grant type Google requires for a signed-JWT (two-legged) exchange. */
export const JWT_BEARER_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:jwt-bearer";

/**
 * Google rejects assertions whose lifetime exceeds one hour. Clamping here
 * rather than trusting the caller means a bad constant upstream produces a
 * shorter token, not an invalid_grant that looks like a key problem.
 */
export const MAX_ASSERTION_LIFETIME_SECONDS = 3600;

export interface GoogleServiceAccountKey {
  client_email: string;
  private_key: string;
  private_key_id?: string;
  token_uri?: string;
  type?: string;
}

export interface AssertionInput {
  key: GoogleServiceAccountKey;
  /** Space-delimited OAuth scopes. */
  scope: string;
  /** Mailbox to impersonate. Required for Workspace Admin SDK calls. */
  subject?: string;
  /** Seconds since the epoch. Injected so tests are deterministic. */
  nowSeconds?: number;
  /** Requested lifetime, clamped to MAX_ASSERTION_LIFETIME_SECONDS. */
  lifetimeSeconds?: number;
}

/** Base64url per RFC 7515: no padding, - for +, _ for /. */
export function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Parses and validates the JSON a customer downloads from the Google Cloud
 * console. Throws with a message that says which field is wrong, because the
 * most common support case here is a pasted fragment rather than the whole
 * file.
 */
export function parseServiceAccountKey(raw: string): GoogleServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Service account key is not valid JSON. Paste the whole downloaded key file, not a fragment of it.",
    );
  }

  const key = parsed as Partial<GoogleServiceAccountKey>;
  if (!key || typeof key !== "object") {
    throw new Error("Service account key must be a JSON object.");
  }
  if (!key.client_email) {
    throw new Error("Service account key is missing client_email.");
  }
  if (!key.private_key) {
    throw new Error("Service account key is missing private_key.");
  }
  if (!/BEGIN (RSA )?PRIVATE KEY/.test(key.private_key)) {
    throw new Error(
      "Service account private_key does not look like a PEM block. Check that newlines survived the paste.",
    );
  }

  return {
    client_email: key.client_email,
    private_key: key.private_key,
    private_key_id: key.private_key_id,
    token_uri: key.token_uri,
    type: key.type,
  };
}

/**
 * Returns a complete, signed assertion. The signature covers exactly the
 * bytes of "{base64url header}.{base64url claims}", which is what Google
 * specifies as the signing input.
 */
export function buildServiceAccountAssertion(input: AssertionInput): string {
  const { key, scope, subject } = input;
  if (!scope || !scope.trim()) {
    throw new Error("At least one OAuth scope is required.");
  }

  const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const requested = input.lifetimeSeconds ?? MAX_ASSERTION_LIFETIME_SECONDS;
  const lifetime = Math.min(
    Math.max(1, Math.floor(requested)),
    MAX_ASSERTION_LIFETIME_SECONDS,
  );

  const header: Record<string, string> = { alg: "RS256", typ: "JWT" };
  if (key.private_key_id) header.kid = key.private_key_id;

  const claims: Record<string, string | number> = {
    iss: key.client_email,
    scope: scope.trim(),
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat,
    exp: iat + lifetime,
  };
  if (subject) claims.sub = subject;

  const signingInput =
    base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));

  let signature: Buffer;
  try {
    signature = createSign("RSA-SHA256").update(signingInput).sign(key.private_key);
  } catch (err) {
    throw new Error(
      "Could not sign with the supplied private_key: " +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  return signingInput + "." + base64url(signature);
}

/** The form body for the token exchange. Kept next to the signer so the two cannot drift. */
export function buildTokenRequestBody(assertion: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: JWT_BEARER_GRANT_TYPE,
    assertion,
  });
}
