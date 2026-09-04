/**
 * The connector engine: turn a spec plus a customer's credentials into one real
 * authenticated request, and decide from the answer whether the integration is
 * connected.
 *
 * This replaces connectDemo(), which decided the same question with
 * Math.random(). There is no local approximation of a vendor's answer here and
 * deliberately no fallback: if the request cannot be made or the vendor refuses
 * it, the connection fails and says why.
 *
 * Three things this file is careful about
 * -------------------------------------------------------------------------
 * 1. Header injection. Credential values are interpolated into request headers.
 *    A value containing CR or LF would let whoever reached the connect endpoint
 *    append headers to an outbound request. Rejected before any template is
 *    resolved, not sanitised afterwards.
 *
 * 2. Host and path smuggling. Non-secret fields land in URLs. A "domain" value
 *    of "acme.atlassian.net/../../x" changes which host and path is called.
 *    Non-secret values are restricted to a hostname-safe character set, and
 *    fields that are whole URLs must parse as https.
 *
 * 3. Leaking the credential back. Nothing derived from a submitted value
 *    appears in a return value, a thrown message, or a log line. The failure
 *    detail is the vendor's status code and a short excerpt of the vendor's own
 *    response body, with anything resembling the submitted secrets removed.
 *
 * The outbound call goes through guardedFetch, so a tenant-supplied base URL
 * cannot be aimed at link-local or private addresses.
 */

// SSRF: every URL here is built partly from tenant configuration.
import { guardedFetch } from "../../lib/guarded-fetch.js";
import type { ConnectorSpec, Verification } from "./connector-specs";
import type { PinnedResponse } from "../../lib/ssrf-guard.js";

/** Field names whose value must be a complete https URL. */
const URL_FIELD = /(url|addr|endpoint)$/i;

/** Hostname-safe. Deliberately excludes "/", "?", "#", ":" and whitespace. */
const SAFE_PLAIN = /^[A-Za-z0-9._@+-]+$/;

const MAX_FIELD_LENGTH = 1024;

export interface FieldProblem {
  field: string;
  message: string;
}

export interface ValidatedFields {
  ok: true;
  values: Record<string, string>;
}

export interface InvalidFields {
  ok: false;
  problems: FieldProblem[];
}

/**
 * Check a submitted credential set against its spec.
 *
 * Returns problems as a list rather than throwing on the first one, so someone
 * filling in four fields is told about all four mistakes at once instead of
 * discovering them one round trip at a time.
 */
export function validateSubmittedFields(
  spec: ConnectorSpec,
  body: Record<string, unknown>,
): ValidatedFields | InvalidFields {
  const problems: FieldProblem[] = [];
  const values: Record<string, string> = {};

  for (const field of spec.fields) {
    const raw = body[field.key];
    const value = raw == null ? "" : String(raw).trim();

    if (!value) {
      if (field.required) problems.push({ field: field.key, message: field.label + " is required." });
      continue;
    }

    if (value.length > MAX_FIELD_LENGTH) {
      problems.push({ field: field.key, message: field.label + " is longer than " + MAX_FIELD_LENGTH + " characters." });
      continue;
    }

    // CR and LF first, for every field including secrets. This is the header
    // injection control and it applies to the values hardest to constrain
    // otherwise.
    if (/[\r\n\u0000]/.test(value)) {
      problems.push({ field: field.key, message: field.label + " contains a line break or null byte." });
      continue;
    }

    if (URL_FIELD.test(field.key)) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(value);
      } catch {
        parsed = null;
      }
      if (!parsed || parsed.protocol !== "https:") {
        problems.push({ field: field.key, message: field.label + " must be a complete https:// URL." });
        continue;
      }
      // Trailing slashes would double up when templates append a path.
      values[field.key] = value.replace(/\/+$/, "");
      continue;
    }

    if (!field.secret && !SAFE_PLAIN.test(value)) {
      problems.push({
        field: field.key,
        message:
          field.label + " may only contain letters, numbers and . _ @ + - characters. " +
          "It is used to build the address this platform calls, so slashes and colons are refused.",
      });
      continue;
    }

    values[field.key] = value;
  }

  // A field the spec never declared is not stored. Otherwise an extra property
  // in the request body would end up in the config column, outside every rule
  // that decides what is a secret and what may be serialised.
  return problems.length > 0 ? { ok: false, problems } : { ok: true, values };
}

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

/**
 * Resolve one side of a basic-auth template.
 *
 * Each side is a slash-joined list of tokens, and each token is either a field
 * name or a literal. That is what lets Zendesk's "<email>/token" username be
 * written as "email/token" without a special case in the engine: the first
 * token resolves, the second does not, and the result is joined back together.
 */
function resolveBasicSide(side: string, values: Record<string, string>): string {
  return side
    .split("/")
    .map((token) => (token in values ? values[token] : token))
    .join("/");
}

/**
 * Substitute a template in a single pass.
 *
 * Single pass matters. A customer-supplied value that itself contains a
 * placeholder must be treated as text, not resolved again, or one credential
 * field could be made to expand into another.
 */
export function resolveTemplate(
  template: string,
  values: Record<string, string>,
  accessToken?: string,
): string {
  return template.replace(/\$\{([^}]+)\}/g, (_match, expression: string) => {
    if (expression.startsWith("basic:")) {
      const [, left, right = ""] = expression.split(":");
      return base64(resolveBasicSide(left, values) + ":" + resolveBasicSide(right, values));
    }
    if (expression === "accessToken") return accessToken ?? "";
    const [name, fallback] = expression.split("|");
    const value = values[name];
    if (value !== undefined && value !== "") return value;
    return fallback ?? "";
  });
}

export interface VerifyOutcome {
  ok: boolean;
  /** HTTP status from the vendor, or null if the request never completed. */
  status: number | null;
  /** Safe to show a customer and safe to log. Never derived from a credential. */
  detail: string;
  /** Which stage failed, so a token grant failure is not reported as a bad scope. */
  stage: "grant" | "verify" | "none";
}

/**
 * Remove anything that looks like a submitted credential from text about to be
 * returned or logged.
 *
 * Vendors do echo a token back inside an error message. This is the last line of
 * defence before that text reaches a response body.
 */
function scrub(text: string, spec: ConnectorSpec, values: Record<string, string>): string {
  let out = text;
  for (const field of spec.fields) {
    if (!field.secret) continue;
    const value = values[field.key];
    if (value && value.length >= 6) out = out.split(value).join("[redacted]");
  }
  return out;
}

async function readExcerpt(response: PinnedResponse, spec: ConnectorSpec, values: Record<string, string>): Promise<string> {
  try {
    const text = (await response.text()).slice(0, 300);
    return scrub(text, spec, values).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function headersFrom(
  template: Record<string, string> | undefined,
  values: Record<string, string>,
  accessToken?: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(template ?? {})) {
    out[name] = resolveTemplate(value, values, accessToken);
  }
  return out;
}

async function runGrant(
  spec: ConnectorSpec,
  values: Record<string, string>,
): Promise<{ token: string } | VerifyOutcome> {
  const grant = spec.grant!;
  const url = resolveTemplate(grant.url, values);
  const body = resolveTemplate(grant.body, values);
  const headers = headersFrom(grant.headers, values);
  headers["Content-Type"] = grant.encoding === "json" ? "application/json" : "application/x-www-form-urlencoded";
  headers["Accept"] = "application/json";

  let response: PinnedResponse;
  try {
    response = await guardedFetch(url, { method: "POST", headers, body });
  } catch (err) {
    return {
      ok: false,
      status: null,
      stage: "grant",
      // The message can name the host but never the credential.
      detail: "Could not reach the token endpoint: " + scrub(String((err as Error).message ?? err), spec, values),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      stage: "grant",
      detail:
        "The vendor refused the credentials at the token step (HTTP " + response.status + "). " +
        (await readExcerpt(response, spec, values)),
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, status: response.status, stage: "grant", detail: "The token endpoint did not return JSON." };
  }

  const token = payload[grant.tokenField];
  if (typeof token !== "string" || !token) {
    return {
      ok: false,
      status: response.status,
      stage: "grant",
      detail: "The token endpoint answered without a " + grant.tokenField + " value.",
    };
  }
  return { token };
}

/**
 * Make the one request that decides whether these credentials work.
 *
 * A 401 or 403 is a wrong credential. A 404 usually means the wrong instance or
 * region. Both are reported as the vendor said them rather than collapsed into
 * "connection failed", because the fix is different in each case.
 */
export async function verifyConnector(
  spec: ConnectorSpec,
  values: Record<string, string>,
): Promise<VerifyOutcome> {
  if (spec.state === "unavailable") {
    return {
      ok: false,
      status: null,
      stage: "none",
      detail: spec.unavailableReason ?? "This connector is not available yet.",
    };
  }
  if (!spec.verify) {
    return { ok: false, status: null, stage: "none", detail: "This connector has no verification step defined." };
  }

  let accessToken: string | undefined;
  if (spec.grant) {
    const granted = await runGrant(spec, values);
    if ("ok" in granted) return granted;
    accessToken = granted.token;
  }

  const verify: Verification = spec.verify;
  const url = resolveTemplate(verify.url, values, accessToken);
  const headers = headersFrom(verify.headers, values, accessToken);
  headers["Accept"] = headers["Accept"] ?? "application/json";
  if (verify.contentType) headers["Content-Type"] = verify.contentType;

  let response: PinnedResponse;
  try {
    response = await guardedFetch(url, {
      method: verify.method,
      headers,
      body: verify.body ? resolveTemplate(verify.body, values, accessToken) : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      status: null,
      stage: "verify",
      detail: "Could not reach the vendor: " + scrub(String((err as Error).message ?? err), spec, values),
    };
  }

  if (!response.ok) {
    const excerpt = await readExcerpt(response, spec, values);
    const hint =
      response.status === 401 || response.status === 403
        ? "The credentials were rejected. Check the value and, for scoped tokens, the permissions granted to it."
        : response.status === 404
          ? "The endpoint was not found. This usually means the instance, region or tenant identifier is wrong."
          : "";
    return {
      ok: false,
      status: response.status,
      stage: "verify",
      detail: ("HTTP " + response.status + ". " + hint + " " + excerpt).trim(),
    };
  }

  // Some vendors answer 200 with a failure in the body. Slack is the reason
  // this exists: a bad token returns 200 and { ok: false }.
  if (verify.requireJsonTrue) {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
    if (!payload || !payload[verify.requireJsonTrue]) {
      const reported = payload && typeof payload.error === "string" ? String(payload.error) : "no reason given";
      return {
        ok: false,
        status: response.status,
        stage: "verify",
        detail: "The vendor answered HTTP 200 but reported the credential as invalid: " + reported + ".",
      };
    }
  }

  return { ok: true, status: response.status, stage: "none", detail: "Verified against the vendor's API." };
}
