import { Injectable, NotFoundException } from "@nestjs/common";
import { getRateLimitPool } from "../../lib/pg-pool.js";
import { logger } from "../../lib/logger.js";
import nodemailer from "nodemailer";

const BASE_URL = process.env["APP_URL"] || "https://grc.colorcodesolutions.com";
const FROM = process.env["SMTP_FROM"] || "EnterpriseComply <noreply@grc.colorcodesolutions.com>";

function createTransport(): nodemailer.Transporter | null {
  const resendKey = process.env["RESEND_API_KEY"];
  if (resendKey) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: resendKey },
    });
  }
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] || 587);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) {
    logger.warn("[status-subscribers] SMTP not configured — emails will be skipped");
    return null;
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, "[status-subscribers] email skipped — no SMTP");
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    logger.info({ to: opts.to, subject: opts.subject }, "[status-subscribers] email sent");
  } catch (err) {
    logger.error({ err, to: opts.to }, "[status-subscribers] email send failed");
  }
}

@Injectable()
export class StatusSubscribersService {
  private async pool() {
    return getRateLimitPool();
  }

  async ensureSchema(): Promise<void> {
    const pool = await this.pool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS status_subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        org_id INTEGER,
        confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        confirm_token TEXT,
        unsub_token TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // status_subscribers is created lazily, on the first subscription, so it
    // can come into existence long after the boot-time tenant RLS sweep has
    // run. Whoever creates a table carrying org_id owns protecting it, so the
    // isolation policy is installed right here instead of being left to a
    // later sweep that may never see the table.
    await pool.query("ALTER TABLE status_subscribers ENABLE ROW LEVEL SECURITY");
    await pool.query("DROP POLICY IF EXISTS tenant_isolation ON status_subscribers");
    await pool.query(
      "CREATE POLICY tenant_isolation ON status_subscribers " +
        "USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::int) " +
        "WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::int)",
    );
  }

  async subscribe(email: string, orgId?: number): Promise<{ ok: boolean }> {
    await this.ensureSchema();
    const pool = await this.pool();
    const unsubToken = randomToken();
    const confirmToken = randomToken();

    await pool.query(
      `INSERT INTO status_subscribers (email, org_id, confirmed, confirm_token, unsub_token)
       VALUES ($1, $2, FALSE, $3, $4)
       ON CONFLICT DO NOTHING`,
      [email, orgId ?? null, confirmToken, unsubToken],
    );

    const confirmUrl = `${BASE_URL}/api/public/status/confirm?token=${confirmToken}`;
    const unsubUrl   = `${BASE_URL}/api/public/status/unsubscribe?token=${unsubToken}`;

    await sendMail({
      to: email,
      subject: "Confirm your EnterpriseComply status alert subscription",
      html: `<p>Click the link below to confirm your subscription to EnterpriseComply status alerts:</p>
<p><a href="${confirmUrl}">Confirm subscription</a></p>
<p style="color:#6b7280;font-size:12px;">To unsubscribe, <a href="${unsubUrl}">click here</a>.</p>`,
    });

    return { ok: true };
  }

  async confirm(token: string): Promise<{ ok: boolean }> {
    await this.ensureSchema();
    const pool = await this.pool();
    const { rowCount } = await pool.query(
      `UPDATE status_subscribers SET confirmed = TRUE, confirm_token = NULL
       WHERE confirm_token = $1`,
      [token],
    );
    if (!rowCount) throw new NotFoundException("Token not found or already confirmed");
    return { ok: true };
  }

  async unsubscribe(token: string): Promise<{ ok: boolean }> {
    await this.ensureSchema();
    const pool = await this.pool();
    const { rowCount } = await pool.query(
      `DELETE FROM status_subscribers WHERE unsub_token = $1`,
      [token],
    );
    if (!rowCount) throw new NotFoundException("Token not found");
    return { ok: true };
  }

  async notify(opts: {
    type: "incident_open" | "incident_resolve";
    component: string;
    message: string;
  }): Promise<{ ok: boolean; sent: number }> {
    await this.ensureSchema();
    const pool = await this.pool();
    const { rows } = await pool.query<{ email: string; unsub_token: string }>(
      `SELECT email, unsub_token FROM status_subscribers WHERE confirmed = TRUE`,
    );

    const isOpen = opts.type === "incident_open";
    const subject = isOpen
      ? `⚠️ Status Alert: ${opts.component} is experiencing issues`
      : `✅ Resolved: ${opts.component} is back to normal`;

    let sent = 0;
    for (const row of rows) {
      const unsubUrl = `${BASE_URL}/api/public/status/unsubscribe?token=${row.unsub_token}`;
      await sendMail({
        to: row.email,
        subject,
        html: `<p>${opts.message}</p>
<p style="color:#6b7280;font-size:12px;">You're receiving this because you subscribed to EnterpriseComply status alerts.
<a href="${unsubUrl}">Unsubscribe</a>.</p>`,
      });
      sent++;
    }

    return { ok: true, sent };
  }
}
