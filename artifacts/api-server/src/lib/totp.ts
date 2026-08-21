/**
 * RFC 6238 TOTP, RFC 4226 HOTP and RFC 4648 base32, implemented on node crypto.
 *
 * Why this is hand-rolled rather than a dependency: the workspace installs with
 * --frozen-lockfile in CI and on Railway, so a new runtime package cannot be added
 * without regenerating pnpm-lock.yaml. TOTP is a thin wrapper over HMAC, which node
 * already ships, so the safer trade is to implement the spec here and pin it down
 * with the official RFC 6238 Appendix B test vectors. Those run as the first step of
 * the isolation workflow (scripts/totp-vectors.test.mjs), so a regression fails CI
 * before the API server is even started.
 *
 * Defaults are the ones every mainstream authenticator app assumes when the otpauth
 * URI omits them: HMAC-SHA1, a 30 second period, 6 digits.
 */
import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

/** RFC 4648 section 6 alphabet. Padding is not emitted; authenticator apps do not want it. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

/**
 * Periods either side of now that we accept, per the RFC 6238 section 5.2 clock skew
 * guidance. A value of 1 keeps a code usable for roughly 30 seconds past its own
 * window, which is the smallest value that does not punish a phone whose clock is
 * slightly off.
 */
export const TOTP_DRIFT_STEPS = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = String(input == null ? "" : input).toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) throw new Error("Invalid base32 character in TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160 bits, the size RFC 4226 section 4 requires for HMAC-SHA1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** RFC 4226: HMAC over the 8 byte big-endian counter, then dynamic truncation. */
export function hotp(secretBase32: string, counter: number, digits: number = TOTP_DIGITS): string {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter % 0x100000000, 4);
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const truncated =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(truncated % Math.pow(10, digits)).padStart(digits, "0");
}

export function totpCounterAt(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
}

export function totp(secretBase32: string, atMs: number = Date.now()): string {
  return hotp(secretBase32, totpCounterAt(atMs));
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Returns the counter the code matched, or null when nothing matched.
 *
 * minCounter is the replay guard: callers persist the counter they last accepted and
 * pass it back here, so a code observed in transit cannot be spent a second time
 * inside its own window.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { atMs?: number; driftSteps?: number; minCounter?: number } = {},
): number | null {
  const candidate = String(code == null ? "" : code).replace(/\D/g, "");
  if (candidate.length !== TOTP_DIGITS) return null;
  const now = totpCounterAt(opts.atMs === undefined ? Date.now() : opts.atMs);
  const drift = opts.driftSteps === undefined ? TOTP_DRIFT_STEPS : opts.driftSteps;
  for (let step = -drift; step <= drift; step++) {
    const counter = now + step;
    if (counter < 0) continue;
    if (opts.minCounter !== undefined && counter <= opts.minCounter) continue;
    if (constantTimeEquals(hotp(secretBase32, counter), candidate)) return counter;
  }
  return null;
}

/** Key Uri Format: the otpauth:// string an authenticator app scans. */
export function buildOtpauthUri(params: { secret: string; accountName: string; issuer: string }): string {
  const label = encodeURIComponent(params.issuer) + ":" + encodeURIComponent(params.accountName);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return "otpauth://totp/" + label + "?" + query.toString();
}

/**
 * Backup codes. Ambiguous glyphs (I, O, 0, 1) are left out so a code read off a screen
 * and typed by hand does not fail for cosmetic reasons. The alphabet is 32 symbols and
 * 256 divides by 32 exactly, so the modulo below introduces no bias.
 */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const BACKUP_CODE_COUNT = 10;

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(10);
    let raw = "";
    for (let j = 0; j < bytes.length; j++) {
      raw += BACKUP_CODE_ALPHABET[bytes[j] % BACKUP_CODE_ALPHABET.length];
    }
    codes.push(raw.slice(0, 5) + "-" + raw.slice(5));
  }
  return codes;
}

/** Hyphens, spaces and case are cosmetic. */
export function normalizeBackupCode(code: string): string {
  return String(code == null ? "" : code).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Backup codes are stored hashed, never in the clear. Each one carries 50 bits of
 * entropy and is single use, so a plain SHA-256 is the right tool here: there is no
 * dictionary worth running against them, and a slow KDF would only add latency to the
 * one path a locked-out user depends on.
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}
