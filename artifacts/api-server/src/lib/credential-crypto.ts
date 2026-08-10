/**
 * credential-crypto.ts
 *
 * AES-256-GCM field-level encryption for integration credentials stored in
 * the `org_integrations` table (access_token, refresh_token, config JSONB).
 *
 * Key derivation priority:
 *   1. INTEGRATION_CREDENTIAL_KEY env var (32-byte hex string, preferred)
 *   2. Derived from SESSION_SECRET via HMAC-SHA256 (fallback with warning)
 *   3. Dev-only constant — ONLY in NODE_ENV=development; throws in all other envs.
 *
 * Encrypted format:  enc:v1:<iv_hex>$<ciphertext_hex>$<tag_hex>
 * Idempotent:        already-encrypted values are returned unchanged.
 * Transparent reads: legacy plaintext values are returned as-is so the
 *                    service layer works before and after migration.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from 'crypto';
import { Logger } from '@nestjs/common';

const ALGO = 'aes-256-gcm' as const;
export const ENC_PREFIX = 'enc:v1:';
const DEV_FALLBACK_KEY = 'dev-only-fallback-credential-key-DO-NOT-USE-OUTSIDE-DEVELOPMENT';

const log = new Logger('CredentialCrypto');

/**
 * Non-reversible fingerprint of key material, safe to persist in the audit log.
 * Lets compliance teams prove which key was in use, and lets the rotation
 * endpoint recognise a key that has already been retired, without ever
 * writing key material anywhere.
 */
export function keyFingerprint(key: Buffer | string): string {
  const buf = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  return 'sha256:' + createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
let _cachedKey: Buffer | null = null;

/**
 * Validates that adequate key material exists for the current environment.
 * Call this once at startup (before any encrypt/decrypt operations).
 *
 * - Production / staging (NODE_ENV !== 'development'):
 *     Throws if neither INTEGRATION_CREDENTIAL_KEY nor SESSION_SECRET is set.
 * - Development:
 *     Allows the dev-only fallback but logs a warning.
 */
export function validateCredentialKeyMaterial(): void {
  const isDev = (process.env.NODE_ENV ?? 'development') === 'development';
  const hasKey = !!process.env.INTEGRATION_CREDENTIAL_KEY;
  const hasSecret = !!(process.env.SESSION_SECRET ?? process.env.BETTER_AUTH_SECRET);

  if (!hasKey && !hasSecret) {
    if (!isDev) {
      throw new Error(
        '[SECURITY] INTEGRATION_CREDENTIAL_KEY is not set and SESSION_SECRET is absent. ' +
        'Integration credentials cannot be stored securely. ' +
        'Set INTEGRATION_CREDENTIAL_KEY (openssl rand -hex 32) before starting in production.',
      );
    }
    // Development: allow dev-fallback with a loud warning
    log.warn(
      '[DEV ONLY] Neither INTEGRATION_CREDENTIAL_KEY nor SESSION_SECRET is set. ' +
      'Credential encryption is using an insecure development-only fallback key. ' +
      'This MUST NOT be used outside local development.',
    );
  } else if (!hasKey) {
    log.warn(
      'INTEGRATION_CREDENTIAL_KEY not set — deriving credential encryption key from ' +
      'SESSION_SECRET. Set INTEGRATION_CREDENTIAL_KEY (openssl rand -hex 32) for stronger isolation.',
    );
  }
}

function getDerivedKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const keyHex = process.env.INTEGRATION_CREDENTIAL_KEY;
  if (keyHex) {
    const buf = Buffer.from(keyHex, 'hex');
    if (buf.length === 32) {
      _cachedKey = buf;
      return buf;
    }
    log.warn(
      'INTEGRATION_CREDENTIAL_KEY is not a valid 32-byte hex string ' +
      `(got ${buf.length} bytes) — deriving key from SESSION_SECRET instead.`,
    );
  }

  const secret = process.env.SESSION_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (secret) {
    _cachedKey = createHmac('sha256', secret)
      .update('integration-credential-encryption-key-v1')
      .digest();
    return _cachedKey;
  }

  // No key material available.
  // In production this path should never be reached because validateCredentialKeyMaterial()
  // throws during startup. In development, use the dev-only fallback.
  const isDev = (process.env.NODE_ENV ?? 'development') === 'development';
  if (!isDev) {
    throw new Error(
      '[SECURITY] getDerivedKey called with no key material in a non-development environment. ' +
      'Startup key validation should have prevented this.',
    );
  }

  _cachedKey = createHmac('sha256', DEV_FALLBACK_KEY)
    .update('integration-credential-encryption-key-v1')
    .digest();
  return _cachedKey;
}

/**
 * Encrypt a credential string with AES-256-GCM.
 * Returns enc:v1:<iv>$<ct>$<tag> or null/empty unchanged.
 * Idempotent — already-encrypted values are returned as-is.
 */
export function encryptCredential(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return plain ?? null;
  if (plain.startsWith(ENC_PREFIX)) return plain; // already encrypted

  const key = getDerivedKey();
  const iv = randomBytes(12); // 96-bit nonce for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}$${encrypted.toString('hex')}$${tag.toString('hex')}`;
}

/**
 * Decrypt a credential encrypted by encryptCredential().
 * Transparently handles legacy plaintext (returns as-is — supports zero-downtime migration).
 * Returns null on auth-tag failure (tampered/wrong key).
 */
export function decryptCredential(cipherStr: string | null | undefined): string | null {
  if (cipherStr == null || cipherStr === '') return cipherStr ?? null;
  if (!cipherStr.startsWith(ENC_PREFIX)) return cipherStr; // legacy plaintext

  const body = cipherStr.slice(ENC_PREFIX.length);
  const parts = body.split('$');
  if (parts.length !== 3) {
    log.error('Invalid encrypted credential format (expected enc:v1:<iv>$<ct>$<tag>)');
    return null;
  }

  const [ivHex, ctHex, tagHex] = parts;
  const key = getDerivedKey();

  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'), { authTagLength: 16 });
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    log.error(`Credential decryption failed (tampered data or wrong key): ${(err as Error).message}`);
    return null;
  }
}

/** Returns true if the value was produced by encryptCredential(). */
export function isEncryptedCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/**
 * Returns the current active key buffer (derived from env vars).
 * Useful when callers need the raw key for explicit-key operations.
 */
export function getDerivedKeyBuffer(): Buffer {
  return getDerivedKey();
}

/**
 * Encrypt credential sub-keys within a JSONB config object.
 * Only encrypts the listed fields; other fields are left unchanged.
 */
export function encryptConfigCredentials(
  config: Record<string, unknown> | null | undefined,
  credentialKeys: string[],
): Record<string, unknown> | null {
  if (!config) return config ?? null;
  const result = { ...config };
  for (const key of credentialKeys) {
    if (typeof result[key] === 'string') {
      result[key] = encryptCredential(result[key] as string);
    }
  }
  return result;
}

/**
 * Decrypt credential sub-keys within a JSONB config object.
 * Only decrypts the listed fields; other fields are left unchanged.
 */
export function decryptConfigCredentials(
  config: Record<string, unknown> | null | undefined,
  credentialKeys: string[],
): Record<string, unknown> | null {
  if (!config) return config ?? null;
  const result = { ...config };
  for (const key of credentialKeys) {
    if (typeof result[key] === 'string') {
      result[key] = decryptCredential(result[key] as string);
    }
  }
  return result;
}

/**
 * Decrypt a credential using an explicit 32-byte key buffer rather than the env-derived key.
 * Returns null on auth-tag failure (wrong key / tampered data).
 * Returns the plaintext (or legacy plaintext) for non-encrypted values.
 */
export function decryptCredentialWithKey(
  cipherStr: string | null | undefined,
  keyBuf: Buffer,
): string | null {
  if (cipherStr == null || cipherStr === '') return cipherStr ?? null;
  if (!cipherStr.startsWith(ENC_PREFIX)) return cipherStr; // legacy plaintext

  const body = cipherStr.slice(ENC_PREFIX.length);
  const parts = body.split('$');
  if (parts.length !== 3) return null;

  const [ivHex, ctHex, tagHex] = parts;
  try {
    const decipher = createDecipheriv(ALGO, keyBuf, Buffer.from(ivHex, 'hex'), { authTagLength: 16 });
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext string using an explicit 32-byte key buffer.
 * Returns enc:v1:<iv>$<ct>$<tag>.
 */
export function encryptCredentialWithKey(plain: string, keyBuf: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}$${encrypted.toString('hex')}$${tag.toString('hex')}`;
}

export type RotateResult =
  | { status: 'rotated'; newValue: string }
  | { status: 'skipped_already_new_key' }
  | { status: 'skipped_plaintext'; newValue: string }
  | { status: 'failed'; reason: string };

/**
 * Rotate a single encrypted credential value from oldKey to newKey.
 *
 * Idempotency: if the value can already be decrypted with newKey, it is
 * returned unchanged (already rotated).
 *
 * Returns a RotateResult describing what happened so callers can report
 * counts accurately.
 */
export function rotateCredentialValue(
  cipherStr: string | null | undefined,
  oldKeyBuf: Buffer,
  newKeyBuf: Buffer,
): RotateResult | null {
  if (cipherStr == null || cipherStr === '') return null;

  // 1. Idempotency check — already encrypted with new key?
  if (cipherStr.startsWith(ENC_PREFIX)) {
    const alreadyDecrypted = decryptCredentialWithKey(cipherStr, newKeyBuf);
    if (alreadyDecrypted !== null) {
      return { status: 'skipped_already_new_key' };
    }

    // 2. Decrypt with old key
    const plain = decryptCredentialWithKey(cipherStr, oldKeyBuf);
    if (plain === null) {
      return {
        status: 'failed',
        reason: 'Could not decrypt with old key — may be on a different key or tampered',
      };
    }

    // 3. Re-encrypt with new key
    return { status: 'rotated', newValue: encryptCredentialWithKey(plain, newKeyBuf) };
  }

  // Legacy plaintext — encrypt with new key
  return { status: 'skipped_plaintext', newValue: encryptCredentialWithKey(cipherStr, newKeyBuf) };
}

/**
 * Re-encrypt a single credential value with a new key (hex string, 32 bytes / 64 chars).
 * Decrypts with the current INTEGRATION_CREDENTIAL_KEY, then re-encrypts with newKeyHex.
 * If decryption fails (wrong key / tampered data), the original value is returned unchanged
 * and a warning is logged.
 * Returns null for null/undefined/empty input.
 */
export function reEncryptWithNewKey(
  cipherStr: string | null | undefined,
  newKeyHex: string,
): string | null {
  if (!cipherStr) return cipherStr ?? null;

  // Decrypt with the current key
  const plain = decryptCredential(cipherStr);
  if (plain === null) {
    log.warn(
      'reEncryptWithNewKey: could not decrypt value with current key — leaving unchanged. ' +
      'Ensure INTEGRATION_CREDENTIAL_KEY matches the key used to encrypt this value.',
    );
    return cipherStr;
  }

  // Encrypt with the new key
  const newKeyBuf = Buffer.from(newKeyHex, 'hex');
  if (newKeyBuf.length !== 32) {
    throw new Error('newKeyHex must be a 64-char hex string (32 bytes)');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, newKeyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}$${encrypted.toString('hex')}$${tag.toString('hex')}`;
}

/**
 * Re-encrypt credential sub-keys within a JSONB config object using a new key.
 * Only processes the listed fields; other fields are left unchanged.
 */
export function reEncryptConfigWithNewKey(
  config: Record<string, unknown> | null | undefined,
  credentialKeys: string[],
  newKeyHex: string,
): Record<string, unknown> | null {
  if (!config) return config ?? null;
  const result = { ...config };
  for (const key of credentialKeys) {
    if (typeof result[key] === 'string') {
      result[key] = reEncryptWithNewKey(result[key] as string, newKeyHex);
    }
  }
  return result;
}
