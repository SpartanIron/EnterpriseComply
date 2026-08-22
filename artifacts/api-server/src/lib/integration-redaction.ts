/**
 * Credential redaction for anything derived from org_integrations.
 *
 * The rule: credential material must never be serialised to a browser, not
 * even as ciphertext. Ciphertext in a response body is still credential
 * material. It lands in browser caches, corporate proxy logs, HAR files and
 * support screenshots, and it tells an attacker which accounts hold a token
 * worth stealing.
 *
 * This rule used to live inside integrations.service.ts, where the integrations
 * list applied it faithfully. MonitoringService then read the same rows and
 * spread them into its own response, re-exposing every field the integrations
 * endpoint had just removed. Two consumers, one rule, and only one of them
 * aware of it.
 *
 * The rule lives here now so both consumers depend on the rule rather than on
 * each other, and so the guard in scripts/api-exposure.test.ts can import it
 * without pulling in a Nest module.
 */

/**
 * Config keys whose values are credential material. Compared lower-cased,
 * because provider config is written by hand in several places.
 */
import { secretFieldKeys } from "../modules/integrations/connector-specs";

/**
 * Credential key names written by hand.
 *
 * This list was the whole rule until the connector registry existed, and it was
 * incomplete in a way only measurement showed: "bottoken", "secretkey",
 * "appkey", "clientsecret" and "refreshtoken" were all absent while provider
 * modules in this repository were storing exactly those field names in
 * org_integrations.config. Every one of them would have been serialised to a
 * browser by any endpoint that spread a row.
 *
 * It is kept rather than replaced, for two reasons. It covers legacy rows
 * written before the registry existed, whose config keys no spec declares. And
 * it is a floor: a connector removed from the registry does not quietly stop
 * having its stored secret protected.
 */
export const CREDENTIAL_CONFIG_KEYS = new Set([
  "apitoken",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "token",
  "secret",
  "clientsecret",
  "password",
  "privatekey",
  "adminkey",
  "personalaccesstoken",
  "credential",
]);

/**
 * The set actually used: the hand-written floor above, plus every field any
 * connector spec marks secret.
 *
 * Derived rather than duplicated. Adding a connector declares its secret fields
 * once, and that single declaration both builds the form the customer fills in
 * and protects the value they type into it. There is no second list to forget.
 *
 * Computed once at module load. The specs are static.
 */
export const REDACTED_CONFIG_KEYS: Set<string> = new Set([
  ...CREDENTIAL_CONFIG_KEYS,
  ...secretFieldKeys(),
]);

/**
 * The prefix credential-crypto writes in front of every ciphertext. A string
 * carrying it is credential material whatever the property is called, so this
 * catches a renamed or newly added column nobody added to the set above.
 */
export const CIPHERTEXT_PREFIX = "enc:v1:";

export interface RedactedConnection extends Record<string, unknown> {
  accessToken: null;
  refreshToken: null;
  config: Record<string, unknown>;
  hasStoredCredentials: boolean;
}

/**
 * Returns a copy of an org_integrations row that is safe to serialise: the
 * credential columns nulled, credential keys stripped out of the provider
 * config, and all of it replaced by one boolean, which is the only thing a
 * caller ever legitimately needs to know.
 */
export function redactConnectionCredentials(
  conn: Record<string, unknown>,
): RedactedConnection {
  const rawConfig = (conn.config ?? {}) as Record<string, unknown>;
  const safeConfig: Record<string, unknown> = {};
  let configHasCredential = false;
  for (const [k, v] of Object.entries(rawConfig)) {
    if (REDACTED_CONFIG_KEYS.has(k.toLowerCase())) {
      configHasCredential = true;
      continue;
    }
    safeConfig[k] = v;
  }
  return {
    ...conn,
    accessToken: null,
    refreshToken: null,
    config: safeConfig,
    hasStoredCredentials: Boolean(conn.accessToken) || configHasCredential,
  };
}

/**
 * Deep scan of anything about to be returned to a client. Returns a path for
 * every property holding credential material, so a failing assertion says
 * where the leak is rather than only that one exists.
 *
 * Two independent detectors, because either alone has a blind spot:
 *   - a known credential property name holding a non-empty value
 *   - any string carrying the ciphertext prefix, whatever it is called
 *
 * Deliberately not substring matching on names: tokenExpiresAt is a timestamp,
 * and flagging it would train people to ignore this check.
 */
export function findCredentialLeaks(value: unknown, path = "$"): string[] {
  const leaks: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, at: string): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      if (node.startsWith(CIPHERTEXT_PREFIX)) leaks.push(at + " (ciphertext)");
      return;
    }
    if (typeof node !== "object") return;
    if (node instanceof Date) return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, at + "[" + i + "]"));
      return;
    }

    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const here = at + "." + k;
      const empty = v === null || v === undefined || v === "";
      if (REDACTED_CONFIG_KEYS.has(k.toLowerCase()) && !empty) {
        leaks.push(here + " (credential property)");
        continue;
      }
      walk(v, here);
    }
  };

  walk(value, path);
  return leaks;
}
