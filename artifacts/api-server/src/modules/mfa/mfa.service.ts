import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { decryptCredential, encryptCredential } from "../../lib/credential-crypto";
import { writeAuditLog } from "../../lib/audit-log.js";
import { logger } from "../../lib/logger";
import {
  BACKUP_CODE_COUNT,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  buildOtpauthUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyTotp,
} from "../../lib/totp";

/** Label an authenticator app shows next to the code. */
const ISSUER = "EnterpriseComply";

/** A setup that has been started but not confirmed is only good for this long. */
const ENROLLMENT_TTL_MS = 15 * 60 * 1000;

/** How long a passed step-up challenge keeps a session unlocked. */
export const MFA_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type Row = Record<string, any>;

function rowsOf(result: any): Row[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return Array.isArray(result.rows) ? result.rows : [];
}

function firstRow(result: any): Row | null {
  const rows = rowsOf(result);
  return rows.length > 0 ? rows[0] : null;
}

interface StoredBackupCode {
  h: string;
  used: boolean;
}

/**
 * Read by the auth guard on every request, so it stays a plain indexed lookup rather
 * than a service call.
 *
 * Returns null when the user has not enrolled. That is what keeps the whole step-up
 * mechanism inert until somebody actually finishes setting up an authenticator app:
 * before that point the guard sees exactly what it saw before this feature existed.
 */
export async function readMfaSessionState(
  userId: string,
  sessionId: string | null,
): Promise<{ enrolled: boolean; verifiedAt: Date | null } | null> {
  const enrolled = firstRow(
    await db.execute(sql`SELECT confirmed_at FROM two_factor WHERE "userId" = ${userId} LIMIT 1`),
  );
  if (!enrolled) return null;
  if (!sessionId) return { enrolled: true, verifiedAt: null };
  const session = firstRow(
    await db.execute(sql`SELECT mfa_verified_at FROM session WHERE id = ${sessionId} LIMIT 1`),
  );
  const raw = session ? session.mfa_verified_at : null;
  return { enrolled: true, verifiedAt: raw ? new Date(raw) : null };
}

@Injectable()
export class MfaService {
  private async record(userId: string): Promise<Row | null> {
    return firstRow(
      await db.execute(sql`
        SELECT secret, "backupCodes" AS backup_codes, confirmed_at, last_counter, backup_codes_used
        FROM two_factor
        WHERE "userId" = ${userId}
        LIMIT 1
      `),
    );
  }

  private parseBackupCodes(row: Row | null): StoredBackupCode[] {
    if (!row) return [];
    try {
      const parsed = JSON.parse(String(row.backup_codes == null ? "[]" : row.backup_codes));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry: any) => entry && typeof entry.h === "string")
        .map((entry: any) => ({ h: entry.h, used: entry.used === true }));
    } catch {
      return [];
    }
  }

  private async audit(orgId: number | null, action: string, userId: string, details: unknown) {
    if (orgId == null) return;
    try {
      await writeAuditLog(orgId, action, "user", userId, details, userId);
    } catch (err) {
      logger.warn({ err, action }, "[mfa] audit write failed");
    }
  }

  async status(userId: string) {
    const row = await this.record(userId);
    const pending = firstRow(
      await db.execute(sql`
        SELECT expires_at FROM mfa_enrollment
        WHERE user_id = ${userId} AND expires_at > NOW()
        LIMIT 1
      `),
    );
    const codes = this.parseBackupCodes(row);
    return {
      enrolled: !!row,
      enrolledAt: row && row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
      backupCodesTotal: codes.length,
      backupCodesRemaining: codes.filter((c) => !c.used).length,
      setupExpiresAt: pending ? new Date(pending.expires_at).toISOString() : null,
      issuer: ISSUER,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
    };
  }

  /**
   * Step one. Mints a secret and returns the otpauth URI. Nothing is enrolled and no
   * policy changes until confirm() proves the app is holding the same secret.
   */
  async start(userId: string, email: string) {
    if (await this.record(userId)) {
      throw new BadRequestException({
        error: "already_enrolled",
        message:
          "An authenticator app is already set up for this account. Remove it first if you want to enrol a new one.",
      });
    }
    const secret = generateTotpSecret();
    const sealed = encryptCredential(secret);
    if (!sealed) {
      logger.error({ userId }, "[mfa] refusing to start enrolment without key material");
      throw new BadRequestException({
        error: "mfa_unavailable",
        message:
          "Multi-factor setup is unavailable because server-side encryption is not configured.",
      });
    }
    const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
    await db.execute(sql`
      INSERT INTO mfa_enrollment (user_id, secret, created_at, expires_at)
      VALUES (${userId}, ${sealed}, NOW(), ${expiresAt.toISOString()})
      ON CONFLICT (user_id) DO UPDATE
        SET secret = EXCLUDED.secret, created_at = NOW(), expires_at = EXCLUDED.expires_at
    `);
    return {
      secret,
      otpauthUri: buildOtpauthUri({ secret, accountName: email || userId, issuer: ISSUER }),
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Step two. A correct code is the only acceptable proof that the app really holds
   * the secret, so this is where enrolment actually happens.
   */
  async confirm(userId: string, orgId: number | null, code: string) {
    const pending = firstRow(
      await db.execute(
        sql`SELECT secret, expires_at FROM mfa_enrollment WHERE user_id = ${userId} LIMIT 1`,
      ),
    );
    if (!pending) {
      throw new BadRequestException({
        error: "no_setup_in_progress",
        message: "There is no setup waiting to be confirmed. Start again to get a fresh QR code.",
      });
    }
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await db.execute(sql`DELETE FROM mfa_enrollment WHERE user_id = ${userId}`);
      throw new BadRequestException({
        error: "setup_expired",
        message: "That setup expired. Start again to get a fresh QR code.",
      });
    }
    const secret = decryptCredential(pending.secret);
    if (!secret) {
      await db.execute(sql`DELETE FROM mfa_enrollment WHERE user_id = ${userId}`);
      throw new BadRequestException({
        error: "mfa_unavailable",
        message: "The pending secret could not be read. Start the setup again.",
      });
    }

    const counter = verifyTotp(secret, code);
    if (counter === null) {
      await this.audit(orgId, "security.mfa_enrollment_failed", userId, { reason: "invalid_code" });
      throw new BadRequestException({
        error: "invalid_code",
        message:
          "That code did not match. Check the clock on your phone, then enter the code currently showing.",
      });
    }

    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    const stored = JSON.stringify(backupCodes.map((c) => ({ h: hashBackupCode(c), used: false })));
    const sealed = encryptCredential(secret);

    // Delete then insert rather than upsert: a legacy row could carry a different
    // primary key, which would trip the id constraint instead of the userId one.
    await db.execute(sql`DELETE FROM two_factor WHERE "userId" = ${userId}`);
    await db.execute(sql`
      INSERT INTO two_factor
        (id, secret, "backupCodes", "userId", confirmed_at, last_counter, backup_codes_used)
      VALUES (${"tf_" + userId}, ${sealed}, ${stored}, ${userId}, NOW(), ${counter}, 0)
    `);
    await db.execute(sql`DELETE FROM mfa_enrollment WHERE user_id = ${userId}`);
    await db.execute(sql`UPDATE "user" SET "twoFactorEnabled" = TRUE WHERE id = ${userId}`);

    await this.audit(orgId, "security.mfa_enrolled", userId, {
      method: "totp",
      backupCodesIssued: backupCodes.length,
    });
    logger.info({ userId }, "[mfa] authenticator app enrolled");

    return { enrolled: true, backupCodes };
  }

  /**
   * Accepts either a live TOTP code or one unused backup code, and reports which was
   * used. TOTP is tried first so a backup code is never silently burned while the app
   * is working.
   */
  private async consume(
    userId: string,
    row: Row,
    code: string,
  ): Promise<{ ok: boolean; via?: string; remaining?: number }> {
    const codes = this.parseBackupCodes(row);
    const secret = decryptCredential(row.secret);
    if (secret) {
      const lastCounter = row.last_counter == null ? undefined : Number(row.last_counter);
      const counter = verifyTotp(secret, code, { minCounter: lastCounter });
      if (counter !== null) {
        await db.execute(
          sql`UPDATE two_factor SET last_counter = ${counter} WHERE "userId" = ${userId}`,
        );
        return { ok: true, via: "totp", remaining: codes.filter((c) => !c.used).length };
      }
    }

    const target = hashBackupCode(code);
    const index = codes.findIndex((c) => !c.used && c.h === target);
    if (index === -1) return { ok: false };
    codes[index].used = true;
    const used = codes.filter((c) => c.used).length;
    await db.execute(sql`
      UPDATE two_factor
      SET "backupCodes" = ${JSON.stringify(codes)}, backup_codes_used = ${used}
      WHERE "userId" = ${userId}
    `);
    logger.warn({ userId, remaining: codes.length - used }, "[mfa] backup code spent");
    return { ok: true, via: "backup_code", remaining: codes.length - used };
  }

  /** Step-up: marks this session as having satisfied the second factor. */
  async verify(userId: string, sessionId: string | null, orgId: number | null, code: string) {
    const row = await this.record(userId);
    if (!row) {
      throw new BadRequestException({
        error: "not_enrolled",
        message: "No authenticator app is set up for this account.",
      });
    }
    const outcome = await this.consume(userId, row, code);
    if (!outcome.ok) {
      await this.audit(orgId, "security.mfa_challenge_failed", userId, { reason: "invalid_code" });
      throw new BadRequestException({
        error: "invalid_code",
        message:
          "That code is not valid. Use the code currently showing in your app, or one of your backup codes.",
      });
    }
    if (sessionId) {
      await db.execute(sql`UPDATE session SET mfa_verified_at = NOW() WHERE id = ${sessionId}`);
    }
    await this.audit(orgId, "security.mfa_verified", userId, { via: outcome.via });
    return { verified: true, via: outcome.via, backupCodesRemaining: outcome.remaining };
  }

  /**
   * Removing the second factor is itself a privileged action, so it costs a valid code.
   * A backup code counts, which is what makes a lost phone recoverable without an
   * administrator having to intervene.
   *
   * Refused outright while the organisation enforces MFA. Otherwise any member could
   * quietly opt out of the policy and the coverage figure on the settings page would
   * stop meaning anything; an owner has to turn the policy off first.
   */
  async disable(userId: string, orgId: number | null, mfaEnforced: boolean, code: string) {
    const row = await this.record(userId);
    if (!row) {
      throw new BadRequestException({
        error: "not_enrolled",
        message: "There is no authenticator app to remove.",
      });
    }
    if (mfaEnforced) {
      throw new ForbiddenException({
        error: "mfa_enforced",
        message:
          "Your organization requires multi-factor authentication, so the authenticator app cannot be removed. An owner must turn the policy off first.",
      });
    }
    const outcome = await this.consume(userId, row, code);
    if (!outcome.ok) {
      await this.audit(orgId, "security.mfa_disable_failed", userId, { reason: "invalid_code" });
      throw new BadRequestException({
        error: "invalid_code",
        message: "That code is not valid, so nothing was changed.",
      });
    }
    await db.execute(sql`DELETE FROM two_factor WHERE "userId" = ${userId}`);
    await db.execute(sql`DELETE FROM mfa_enrollment WHERE user_id = ${userId}`);
    await db.execute(sql`UPDATE "user" SET "twoFactorEnabled" = FALSE WHERE id = ${userId}`);
    await db.execute(sql`UPDATE session SET mfa_verified_at = NULL WHERE "userId" = ${userId}`);
    await this.audit(orgId, "security.mfa_disabled", userId, { via: outcome.via });
    logger.warn({ userId }, "[mfa] authenticator app removed");
    return { enrolled: false };
  }

  /**
   * Fresh codes invalidate the sheet the user is holding, so this also costs a valid
   * code. Anything else would let a stolen session lock the real owner out.
   */
  async regenerateBackupCodes(userId: string, orgId: number | null, code: string) {
    const row = await this.record(userId);
    if (!row) {
      throw new BadRequestException({
        error: "not_enrolled",
        message: "Set up an authenticator app before generating backup codes.",
      });
    }
    const outcome = await this.consume(userId, row, code);
    if (!outcome.ok) {
      throw new BadRequestException({
        error: "invalid_code",
        message: "That code is not valid, so your existing backup codes are unchanged.",
      });
    }
    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    const stored = JSON.stringify(backupCodes.map((c) => ({ h: hashBackupCode(c), used: false })));
    await db.execute(sql`
      UPDATE two_factor
      SET "backupCodes" = ${stored}, backup_codes_used = 0
      WHERE "userId" = ${userId}
    `);
    await this.audit(orgId, "security.mfa_backup_codes_regenerated", userId, {
      issued: backupCodes.length,
    });
    return { backupCodes };
  }
}
