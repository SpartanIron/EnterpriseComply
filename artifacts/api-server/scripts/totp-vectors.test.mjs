/**
 * RFC 6238 Appendix B test vectors for src/lib/totp.ts.
 *
 * A pure unit test: no database, no API server, no network. It runs as the first step
 * of the isolation workflow so that a broken TOTP implementation fails the build in
 * seconds, rather than surfacing in production as codes that are always rejected.
 *
 * The published vectors are 8 digit codes. HOTP truncation reduces the same binary
 * value modulo 10^digits, so the 6 digit code an authenticator app displays is the
 * last six digits of the published value. Both widths are asserted below.
 *
 * Usage:
 *   node --import @swc-node/register/esm-register artifacts/api-server/scripts/totp-vectors.test.mjs
 */
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  hotp,
  normalizeBackupCode,
  totp,
  totpCounterAt,
  verifyTotp,
} from "../src/lib/totp.ts";

let failed = 0;
let passed = 0;

function ok(name, condition, detail) {
  if (condition) {
    passed++;
    console.log("  PASS  " + name);
  } else {
    failed++;
    console.log("  FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

function eq(name, actual, expected) {
  ok(
    name,
    actual === expected,
    "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual),
  );
}

// The RFC 6238 HMAC-SHA1 seed is the ASCII string below.
const RFC_SEED_ASCII = "12345678901234567890";
const RFC_SECRET = base32Encode(Buffer.from(RFC_SEED_ASCII, "ascii"));

console.log("\nbase32 (RFC 4648)");
eq("encodes the RFC 6238 seed", RFC_SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
eq("decodes back to the seed", base32Decode(RFC_SECRET).toString("ascii"), RFC_SEED_ASCII);
eq(
  "tolerates lowercase, spaces and padding",
  base32Decode("gezdgnbv gy3tqojq GEZDGNBVGY3TQOJQ==").toString("ascii"),
  RFC_SEED_ASCII,
);

// [ unix seconds, expected 8 digit HMAC-SHA1 code ] straight from RFC 6238 Appendix B.
const VECTORS = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

console.log("\nRFC 6238 Appendix B vectors");
for (const [seconds, expected8] of VECTORS) {
  const counter = Math.floor(seconds / 30);
  eq("T=" + seconds + " counter", totpCounterAt(seconds * 1000), counter);
  eq("T=" + seconds + " 8 digits", hotp(RFC_SECRET, counter, 8), expected8);
  eq("T=" + seconds + " 6 digits", hotp(RFC_SECRET, counter, 6), expected8.slice(-6));
  eq("T=" + seconds + " through totp()", totp(RFC_SECRET, seconds * 1000), expected8.slice(-6));
}

// Fixed point in time so the drift assertions are deterministic rather than flaky.
const AT_MS = 1111111109 * 1000;
const CURRENT = 37037036;

console.log("\ndrift window and replay guard");
eq("accepts the current step", verifyTotp(RFC_SECRET, "081804", { atMs: AT_MS }), CURRENT);
eq(
  "accepts one step back",
  verifyTotp(RFC_SECRET, hotp(RFC_SECRET, CURRENT - 1), { atMs: AT_MS }),
  CURRENT - 1,
);
eq(
  "accepts one step forward",
  verifyTotp(RFC_SECRET, hotp(RFC_SECRET, CURRENT + 1), { atMs: AT_MS }),
  CURRENT + 1,
);
eq(
  "rejects two steps back",
  verifyTotp(RFC_SECRET, hotp(RFC_SECRET, CURRENT - 2), { atMs: AT_MS }),
  null,
);
eq(
  "rejects a counter already spent",
  verifyTotp(RFC_SECRET, "081804", { atMs: AT_MS, minCounter: CURRENT }),
  null,
);
eq("rejects a short code", verifyTotp(RFC_SECRET, "12345", { atMs: AT_MS }), null);
eq("rejects a non-numeric code", verifyTotp(RFC_SECRET, "abcdef", { atMs: AT_MS }), null);
eq("rejects an empty code", verifyTotp(RFC_SECRET, "", { atMs: AT_MS }), null);

console.log("\notpauth URI");
const uri = buildOtpauthUri({
  secret: RFC_SECRET,
  accountName: "person@example.com",
  issuer: "EnterpriseComply",
});
ok(
  "uses the totp scheme with an issuer prefixed label",
  uri.startsWith("otpauth://totp/EnterpriseComply:person%40example.com?"),
  uri,
);
ok("carries the secret", uri.indexOf("secret=" + RFC_SECRET) !== -1, uri);
ok(
  "pins algorithm, digits and period so apps do not guess",
  uri.indexOf("algorithm=SHA1") !== -1 &&
    uri.indexOf("digits=6") !== -1 &&
    uri.indexOf("period=30") !== -1,
  uri,
);

console.log("\nsecret generation");
const secret = generateTotpSecret();
eq("160 bits encodes to 32 base32 characters", secret.length, 32);
eq("round-trips to 20 bytes", base32Decode(secret).length, 20);
ok("successive secrets differ", generateTotpSecret() !== generateTotpSecret());

console.log("\nbackup codes");
const codes = generateBackupCodes();
eq("issues ten codes", codes.length, 10);
eq("codes are unique", new Set(codes).size, 10);
ok(
  "codes avoid the glyphs people misread",
  codes.every((c) => !/[IO01]/.test(c)),
  codes.join(","),
);
eq(
  "normalizing ignores case and separators",
  normalizeBackupCode(codes[0].toLowerCase().replace("-", " ")),
  normalizeBackupCode(codes[0]),
);
eq(
  "hashing is stable across formatting",
  hashBackupCode(codes[0].toLowerCase().replace("-", " ")),
  hashBackupCode(codes[0]),
);
ok("distinct codes hash distinctly", hashBackupCode(codes[0]) !== hashBackupCode(codes[1]));
eq("hash is hex sha256", hashBackupCode(codes[0]).length, 64);

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
