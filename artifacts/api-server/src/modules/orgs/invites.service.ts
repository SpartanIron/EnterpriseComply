// invites.service.ts — team invitations and member role changes
//
// Settings → Users & Roles has always POSTed /orgs/:orgId/invites and PATCHed
// /orgs/:orgId/members/:memberId/role. Neither route existed on the API, so both
// answered 404 and the UI failed silently. This module is the missing half.
//
// Controls: NIST AC-2 (account management), NIST AC-6 (least privilege),
// NIST IA-5 (authenticator management), SOC 2 CC6.1 / CC6.2 / CC6.3.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  db,
  orgInvitesTable,
  orgMembersTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { ROLE_HIERARCHY } from "../../guards/roles.guard";
import { writeAuditLog } from "../../lib/audit-log.js";
import { sendTeamInviteEmail } from "../../lib/email";
import { logger } from "../../lib/logger";
import { getRateLimitPool } from "../../lib/pg-pool";

/** Seven days — long enough for a real person, short enough to matter. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard cap on resends before an admin has to revoke and start over. */
const MAX_RESENDS = 5;

/**
 * Roles an invitation may grant. "owner" and "super_admin" are deliberately
 * absent: ownership transfer and platform-staff access are separate, deliberate
 * operations, not something an invite email is allowed to do.
 */
const ASSIGNABLE_ROLES = ["admin", "compliance_manager", "analyst", "auditor", "viewer"];

export interface InviteActor {
  id: string;
  email?: string;
  role?: string;
}

type InviteRow = typeof orgInvitesTable.$inferSelect;

@Injectable()
export class InvitesService {
  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private newToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private level(role: string | null | undefined): number {
    return ROLE_HIERARCHY[role ?? "viewer"] ?? 0;
  }

  private normaliseEmail(raw: string): string {
    const email = (raw ?? "").trim().toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(email)) {
      throw new BadRequestException("Enter a valid email address.");
    }
    return email;
  }

  /** The token hash never leaves the server. */
  private present(row: InviteRow) {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: row.expiresAt,
      invitedByEmail: row.invitedByEmail,
      lastSentAt: row.lastSentAt,
      resendCount: row.resendCount,
      createdAt: row.createdAt,
    };
  }

  private async expireStale(orgId: number): Promise<void> {
    await db
      .update(orgInvitesTable)
      .set({ status: "expired" })
      .where(
        and(
          eq(orgInvitesTable.orgId, orgId),
          eq(orgInvitesTable.status, "pending"),
          sql`${orgInvitesTable.expiresAt} < NOW()`,
        ),
      );
  }

  async list(orgId: number) {
    await this.expireStale(orgId);
    const rows = await db.query.orgInvitesTable.findMany({
      where: eq(orgInvitesTable.orgId, orgId),
    });
    return { invites: rows.map((r) => this.present(r)) };
  }

  /**
   * Create an invitation and email it.
   *
   * Two escalation guards matter here. The role has to be one an invitation may
   * grant at all, and it may not exceed the inviter's own level — otherwise an
   * admin could mint an owner and quietly take the tenant over.
   */
  async create(orgId: number, body: { email?: string; role?: string }, actor: InviteActor) {
    const email = this.normaliseEmail(body.email ?? "");
    const role = (body.role ?? "analyst").trim();

    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException(`Role '${role}' cannot be granted by invitation.`);
    }
    if (this.level(role) > this.level(actor.role)) {
      throw new ForbiddenException("You cannot invite someone at a higher role than your own.");
    }

    const existing = await db.query.orgMembersTable.findFirst({
      where: and(
        eq(orgMembersTable.orgId, orgId),
        sql`lower(${orgMembersTable.email}) = ${email}`,
      ),
    });
    if (existing) {
      throw new ConflictException(`${email} is already a member of this organization.`);
    }

    // Supersede any live invite for the same address rather than colliding with
    // the partial unique index on (org_id, lower(email)) WHERE status='pending'.
    await db
      .update(orgInvitesTable)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(orgInvitesTable.orgId, orgId),
          eq(orgInvitesTable.status, "pending"),
          sql`lower(${orgInvitesTable.email}) = ${email}`,
        ),
      );

    const token = this.newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const inserted = await db
      .insert(orgInvitesTable)
      .values({
        orgId,
        email,
        role,
        tokenHash: this.hash(token),
        status: "pending",
        expiresAt,
        invitedBy: actor.id,
        invitedByEmail: actor.email ?? null,
      })
      .returning();
    const invite = inserted[0];

    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });

    // The row is real and the link works, so a delivery failure must not fail
    // the request — that would hide a perfectly valid invitation. Report it
    // instead and let the admin resend.
    let emailed = true;
    try {
      await sendTeamInviteEmail({
        to: email,
        orgName: org?.name,
        inviterEmail: actor.email,
        roleLabel: role.replace(/_/g, " "),
        token,
        orgId,
        expiresAt,
      });
    } catch (err) {
      emailed = false;
      logger.error({ err, orgId, email }, "[invites] created but email delivery failed");
    }

    await writeAuditLog(
      orgId,
      "org.invite_created",
      "org_invite",
      String(invite.id),
      { email, role, emailed, expiresAt: expiresAt.toISOString() },
      actor.id,
      actor.email,
    );

    return { invite: this.present(invite), emailed };
  }

  async revoke(orgId: number, inviteId: number, actor: InviteActor) {
    const invite = await this.mustFindPending(orgId, inviteId);
    await db
      .update(orgInvitesTable)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(orgInvitesTable.id, invite.id));

    await writeAuditLog(
      orgId,
      "org.invite_revoked",
      "org_invite",
      String(invite.id),
      { email: invite.email, role: invite.role },
      actor.id,
      actor.email,
    );
    return { ok: true };
  }

  /** Resending rotates the token, so any link already in a mailbox stops working. */
  async resend(orgId: number, inviteId: number, actor: InviteActor) {
    const invite = await this.mustFindPending(orgId, inviteId);
    if ((invite.resendCount ?? 0) >= MAX_RESENDS) {
      throw new ForbiddenException(
        "Resend limit reached. Revoke this invitation and issue a new one.",
      );
    }

    const token = this.newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await db
      .update(orgInvitesTable)
      .set({
        tokenHash: this.hash(token),
        expiresAt,
        lastSentAt: new Date(),
        resendCount: (invite.resendCount ?? 0) + 1,
      })
      .where(eq(orgInvitesTable.id, invite.id));

    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });
    await sendTeamInviteEmail({
      to: invite.email,
      orgName: org?.name,
      inviterEmail: actor.email,
      roleLabel: invite.role.replace(/_/g, " "),
      token,
      orgId,
      expiresAt,
    });

    await writeAuditLog(
      orgId,
      "org.invite_resent",
      "org_invite",
      String(invite.id),
      { email: invite.email, attempt: (invite.resendCount ?? 0) + 1 },
      actor.id,
      actor.email,
    );
    return { ok: true };
  }

  private async mustFindPending(orgId: number, inviteId: number): Promise<InviteRow> {
    if (!Number.isInteger(inviteId)) {
      throw new BadRequestException("Invalid invitation id.");
    }
    await this.expireStale(orgId);
    const invite = await db.query.orgInvitesTable.findFirst({
      where: and(eq(orgInvitesTable.id, inviteId), eq(orgInvitesTable.orgId, orgId)),
    });
    if (!invite) throw new NotFoundException("Invitation not found.");
    if (invite.status !== "pending") {
      throw new ConflictException(`This invitation is already ${invite.status}.`);
    }
    return invite;
  }

  /**
   * Redeem an invitation.
   *
   * Unauthenticated by design: possession of the token IS the authorisation,
   * which is why it is 32 random bytes, single use, scoped to one org, and held
   * only as a SHA-256 hash. The controller rate limits this route so it cannot
   * be used as a token-guessing oracle.
   *
   * The magic-link plugin runs with disableSignUp:true, so a brand new invitee
   * has no way to sign in until a row exists in "user". Creating that row here
   * is what turns the invitation into usable access. emailVerified is set
   * because clicking a link delivered to that mailbox demonstrates control of it.
   */
  async accept(orgId: number, token: string) {
    if (!token || token.length < 20) {
      throw new BadRequestException("This invitation link is not valid.");
    }
    await this.expireStale(orgId);

    const invite = await db.query.orgInvitesTable.findFirst({
      where: and(
        eq(orgInvitesTable.orgId, orgId),
        eq(orgInvitesTable.tokenHash, this.hash(token)),
      ),
    });
    if (!invite) throw new NotFoundException("This invitation link is not valid.");
    if (invite.status === "accepted") {
      throw new ConflictException("This invitation has already been used.");
    }
    if (invite.status !== "pending") {
      const newer = await db.query.orgInvitesTable.findFirst({
        where: and(
          eq(orgInvitesTable.orgId, orgId),
          eq(orgInvitesTable.status, "pending"),
          sql`lower(${orgInvitesTable.email}) = ${invite.email.toLowerCase()}`,
        ),
      });
      throw new ForbiddenException(
        newer
          ? "A newer invitation was sent to this address. Open the most recent invitation email and use the link in it."
          : "This invitation is no longer valid.",
      );
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new ForbiddenException("This invitation has expired.");
    }

    const pool = getRateLimitPool();
    const found = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1',
      [invite.email],
    );
    let userId = found.rows[0]?.id;
    if (!userId) {
      userId = randomBytes(16).toString("hex");
      await pool.query(
        'INSERT INTO "user" (id, name, email, "emailVerified", role, "orgId") ' +
          "VALUES ($1, $2, $3, TRUE, $4, $5) ON CONFLICT (email) DO NOTHING",
        [userId, invite.email.split("@")[0], invite.email, invite.role, orgId],
      );
      const reread = await pool.query<{ id: string }>(
        'SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1',
        [invite.email],
      );
      userId = reread.rows[0]?.id ?? userId;
    }

    const already = await db.query.orgMembersTable.findFirst({
      where: and(
        eq(orgMembersTable.orgId, orgId),
        eq(orgMembersTable.clerkUserId, userId),
      ),
    });
    if (!already) {
      await db.insert(orgMembersTable).values({
        orgId,
        clerkUserId: userId,
        email: invite.email,
        role: invite.role,
      });
    }

    await db
      .update(orgInvitesTable)
      .set({ status: "accepted", acceptedAt: new Date(), acceptedBy: userId })
      .where(eq(orgInvitesTable.id, invite.id));

    await writeAuditLog(
      orgId,
      "org.invite_accepted",
      "org_invite",
      String(invite.id),
      { email: invite.email, role: invite.role },
      userId,
      invite.email,
    );

    return { ok: true, email: invite.email, orgId };
  }

  /**
   * Change a member's role.
   *
   * Guards, in order: the role has to be assignable, the actor may not grant a
   * role above their own level, the actor may not touch a member above their own
   * level, and the final owner cannot be demoted — an org with no owner is
   * unadministrable and there is no self-service way back.
   */
  async updateMemberRole(
    orgId: number,
    memberId: number,
    role: string,
    actor: InviteActor,
  ) {
    if (!Number.isInteger(memberId)) {
      throw new BadRequestException("Invalid member id.");
    }

    const target = await db.query.orgMembersTable.findFirst({
      where: and(eq(orgMembersTable.id, memberId), eq(orgMembersTable.orgId, orgId)),
    });
    if (!target) {
      throw new NotFoundException("Member not found in this organization.");
    }

    const assignable = [...ASSIGNABLE_ROLES, "owner"];
    if (!assignable.includes(role)) {
      throw new BadRequestException(`Role '${role}' cannot be assigned.`);
    }
    if (this.level(role) > this.level(actor.role)) {
      throw new ForbiddenException("You cannot grant a role above your own.");
    }
    if (this.level(target.role) > this.level(actor.role)) {
      throw new ForbiddenException(
        "You cannot change the role of a member ranked above you.",
      );
    }
    if (target.role === role) {
      return { member: target };
    }

    if (target.role === "owner") {
      const owners = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(orgMembersTable)
        .where(and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.role, "owner")));
      if (parseInt(owners[0]?.count ?? "0", 10) <= 1) {
        throw new ConflictException("An organization must keep at least one owner.");
      }
    }

    const updated = await db
      .update(orgMembersTable)
      .set({ role })
      .where(and(eq(orgMembersTable.id, memberId), eq(orgMembersTable.orgId, orgId)))
      .returning();

    await writeAuditLog(
      orgId,
      "org.member_role_changed",
      "org_member",
      String(memberId),
      { email: target.email, from: target.role, to: role },
      actor.id,
      actor.email,
    );

    return { member: updated[0] };
  }
}
