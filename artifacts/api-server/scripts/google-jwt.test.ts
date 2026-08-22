/**
 * Guard: the Google service-account assertion is really signed.
 *
 * The defect this replaces was not a subtle one. The provider built its JWT
 * as the header, the claim set, and the literal string "signature", encoded
 * the first two with btoa() rather than base64url, and shipped with a comment
 * saying it was simulating the call structure. Nothing in CI noticed, because
 * nothing in CI could reach Google.
 *
 * So the properties checked here are the ones that do not need Google:
 *
 *   1. The third segment is a signature that verifies. A throwaway RSA keypair
 *      is generated in-process, the assertion is signed with the private half,
 *      and the signature is verified with the public half over exactly the
 *      bytes Google specifies as the signing input.
 *   2. A signature from a different key does NOT verify, so the check above
 *      cannot pass vacuously.
 *   3. Tampering with the claim set breaks verification.
 *   4. The encoding is base64url, not base64. Padding and the two substituted
 *      characters are the difference between a token and a 400.
 *   5. The header and claims carry what Google requires.
 *   6. Lifetime is clamped to one hour.
 *   7. The provider source no longer contains the fake third segment. This is
 *      the assertion that would have caught the original bug.
 *
 * Runs without a database, without network access, and without a Google
 * account.
 */

import { createVerify, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  base64url,
  buildServiceAccountAssertion,
  buildTokenRequestBody,
  GOOGLE_TOKEN_ENDPOINT,
  JWT_BEARER_GRANT_TYPE,
  MAX_ASSERTION_LIFETIME_SECONDS,
  parseServiceAccountKey,
} from "../src/lib/google-jwt";

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n" + "        " + detail);
  }
}

function decodeSegment(segment: string): any {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { privateKey, publicKey };
}

console.log("\ngoogle service-account assertion\n");

const a = keypair();
const b = keypair();

const key = {
  client_email: "compliance-reader@example-project.iam.gserviceaccount.com",
  private_key: a.privateKey,
  private_key_id: "0123456789abcdef0123456789abcdef01234567",
};

const SCOPES =
  "https://www.googleapis.com/auth/admin.directory.user.readonly";
const NOW = 1_800_000_000;

const assertion = buildServiceAccountAssertion({
  key,
  scope: SCOPES,
  subject: "admin@example.com",
  nowSeconds: NOW,
});

const parts = assertion.split(".");
check(
  "assertion has three segments",
  parts.length === 3,
  "got " + parts.length + " segment(s)",
);

check(
  "third segment is not the literal word signature",
  parts[2] !== "signature" && parts[2].length > 100,
  "third segment was: " + parts[2],
);

const signingInput = parts[0] + "." + parts[1];
const signature = Buffer.from(
  parts[2].replace(/-/g, "+").replace(/_/g, "/"),
  "base64",
);

check(
  "signature verifies with the matching public key",
  createVerify("RSA-SHA256").update(signingInput).verify(a.publicKey, signature),
  "verification failed against the key that signed it",
);

check(
  "signature does not verify with a different key",
  !createVerify("RSA-SHA256").update(signingInput).verify(b.publicKey, signature),
  "an unrelated public key accepted the signature, so the check above proves nothing",
);

const tamperedClaims = base64url(
  JSON.stringify({ ...decodeSegment(parts[1]), sub: "someone-else@example.com" }),
);
check(
  "tampering with the claim set breaks verification",
  !createVerify("RSA-SHA256")
    .update(parts[0] + "." + tamperedClaims)
    .verify(a.publicKey, signature),
  "a modified claim set still verified",
);

check(
  "segments are base64url, not base64",
  !/[+/=]/.test(parts[0] + parts[1] + parts[2]),
  "found +, / or = in the encoded segments",
);

const header = decodeSegment(parts[0]);
check(
  "header declares RS256 and JWT",
  header.alg === "RS256" && header.typ === "JWT",
  JSON.stringify(header),
);
check(
  "header carries the key id when the key has one",
  header.kid === key.private_key_id,
  JSON.stringify(header),
);

const claims = decodeSegment(parts[1]);
check(
  "iss is the service account address",
  claims.iss === key.client_email,
  JSON.stringify(claims.iss),
);
check(
  "aud is Google's token endpoint",
  claims.aud === GOOGLE_TOKEN_ENDPOINT,
  JSON.stringify(claims.aud),
);
check("scope is carried through", claims.scope === SCOPES, JSON.stringify(claims.scope));
check(
  "sub carries the impersonated mailbox",
  claims.sub === "admin@example.com",
  JSON.stringify(claims.sub),
);
check(
  "iat is the supplied clock",
  claims.iat === NOW,
  JSON.stringify(claims.iat),
);

const overLong = decodeSegment(
  buildServiceAccountAssertion({
    key,
    scope: SCOPES,
    nowSeconds: NOW,
    lifetimeSeconds: 999_999,
  }).split(".")[1],
);
check(
  "lifetime is clamped to one hour",
  overLong.exp - overLong.iat === MAX_ASSERTION_LIFETIME_SECONDS,
  "lifetime was " + (overLong.exp - overLong.iat) + "s",
);

const noSubject = decodeSegment(
  buildServiceAccountAssertion({ key, scope: SCOPES, nowSeconds: NOW }).split(".")[1],
);
check(
  "sub is omitted when no subject is given",
  !("sub" in noSubject),
  JSON.stringify(noSubject),
);

function rejects(name: string, raw: string, expectFragment: string) {
  let message = "";
  try {
    parseServiceAccountKey(raw);
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  check(
    name,
    message.includes(expectFragment),
    "message was: " + (message || "(no error thrown)"),
  );
}

rejects("a non-JSON key is rejected", "not json at all", "not valid JSON");
rejects(
  "a key without client_email is rejected",
  JSON.stringify({ private_key: a.privateKey }),
  "client_email",
);
rejects(
  "a key without private_key is rejected",
  JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com" }),
  "private_key",
);
rejects(
  "a private_key that is not a PEM block is rejected",
  JSON.stringify({
    client_email: "x@y.iam.gserviceaccount.com",
    private_key: "abc123",
  }),
  "PEM",
);

const body = buildTokenRequestBody(assertion);
check(
  "token request uses the jwt-bearer grant",
  body.get("grant_type") === JWT_BEARER_GRANT_TYPE,
  String(body.get("grant_type")),
);
check(
  "token request carries the signed assertion",
  body.get("assertion") === assertion,
  "assertion did not survive into the body",
);

const providerSource = readFileSync(
  join(
    process.cwd(),
    "src/modules/integrations/providers/google-workspace.provider.ts",
  ),
  "utf8",
);

check(
  "the provider no longer fabricates the third JWT segment",
  !/\$\{claim\}\.signature/.test(providerSource) &&
    !/\.signature`/.test(providerSource),
  "the provider source still contains a hand-assembled fake signature",
);
check(
  "the provider signs through the shared helper",
  providerSource.includes("buildServiceAccountAssertion"),
  "the provider does not call buildServiceAccountAssertion",
);
check(
  "the provider requests read-only scopes only",
  !/auth\/admin\.directory\.[a-z.]*(?<!readonly)"/.test(providerSource),
  "a non read-only Admin SDK scope appears in the provider",
);

console.log("");
if (failures > 0) {
  console.error(failures + " check(s) failed");
  process.exit(1);
}
console.log("all checks passed");
