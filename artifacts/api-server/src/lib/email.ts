// EC lib/email.ts — transactional email service
// Nodemailer-based, SMTP-configured, matches C2S email quality standard
// Email types: welcome, onboarding drip (day3/7/14), trial expiry (7d/3d/1d), trial expired

import nodemailer from "nodemailer";
import { logger } from "./logger";

// ── SMTP transport ────────────────────────────────────────────────────────
const FROM = process.env["SMTP_FROM"] || "EnterpriseComply <noreply@enterprisecomply.com>";
const REPLY_TO = process.env["SMTP_REPLY_TO"] || "support@enterprisecomply.com";
const BASE_URL = process.env["APP_URL"] || "https://app.enterprisecomply.com";

function createTransport() {
// Prefer Resend SMTP if RESEND_API_KEY is set
const resendKey = process.env["RESEND_API_KEY"];
if (resendKey) {
return nodemailer.createTransport({
host: "smtp.resend.com",
port: 465,
secure: true,
auth: { user: "resend", pass: resendKey },
});
}

// Fall back to custom SMTP
const host = process.env["SMTP_HOST"];
const port = Number(process.env["SMTP_PORT"] || 587);
const user = process.env["SMTP_USER"];
const pass = process.env["SMTP_PASS"];

if (!host || !user || !pass) {
logger.warn("[email] SMTP not configured — emails will be logged only");
return null;
}
return nodemailer.createTransport({
host,
port,
secure: port === 465,
auth: { user, pass },
pool: true,
maxConnections: 5,
});
}

const transport = createTransport();

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
}): Promise<void> {
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject, tags: opts.tags }, "[email] SMTP not configured — skipping send");
    return;
  }
  try {
    await transport.sendMail({
      from: FROM,
      replyTo: REPLY_TO,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.subject,
      headers: opts.tags
        ? Object.entries(opts.tags).reduce((acc, [k, v]) => ({ ...acc, [`X-EC-${k}`]: v }), {})
        : undefined,
    });
    logger.info({ to: opts.to, subject: opts.subject }, "[email] sent");
  } catch (err) {
    logger.error({ err, to: opts.to, subject: opts.subject }, "[email] send failed");
    throw err;
  }
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────
function wrap(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; color: #111; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb; }
    .logo { font-size: 20px; font-weight: 700; color: #1d4ed8; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    h2 { font-size: 22px; margin: 0 0 16px; }
    p { line-height: 1.6; margin: 0 0 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">EnterpriseComply</div>
    ${body}
    <div class="footer">EnterpriseComply &mdash; GRC for the Enterprise &bull; <a href="${BASE_URL}">app.enterprisecomply.com</a></div>
  </div>
</body>
</html>`;
}

// ── Email functions ───────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  firstName?: string;
  orgName?: string;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const org = opts.orgName || "your organization";
  await send({
    to: opts.to,
    subject: `Welcome to EnterpriseComply, ${name}!`,
    tags: { type: "welcome" },
    html: wrap(`
      <h2>Welcome to EnterpriseComply!</h2>
      <p>Hi ${name},</p>
      <p>You\'ve joined <strong>${org}</strong> on EnterpriseComply. Your GRC platform is ready to help you achieve and maintain compliance with FedRAMP, CMMC, SOC 2, ISO 27001, and more.</p>
      <p>Here\'s what to do next:</p>
      <ul>
        <li>Complete your <strong>organization profile</strong></li>
        <li>Choose your <strong>compliance frameworks</strong></li>
        <li>Connect your first <strong>integration</strong> (GitHub, AWS, Okta)</li>
      </ul>
      <a href="${BASE_URL}/dashboard" class="btn">Get started →</a>
    `),
  });
}

export async function sendOnboardingDripEmail(opts: {
  to: string;
  firstName?: string;
  day: 3 | 7 | 14;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const messages: Record<number, { subject: string; body: string }> = {
    3: {
      subject: `${name}, your compliance framework is waiting`,
      body: `
        <h2>3 days in — have you chosen your framework?</h2>
        <p>Hi ${name},</p>
        <p>Many teams start with <strong>CMMC Level 2</strong> or <strong>SOC 2 Type II</strong>. Our guided wizard maps your existing controls automatically.</p>
        <a href="${BASE_URL}/frameworks" class="btn">Choose a framework →</a>
      `,
    },
    7: {
      subject: `Connect your first integration, ${name}`,
      body: `
        <h2>Integrations unlock automated evidence</h2>
        <p>Hi ${name},</p>
        <p>Connect GitHub, AWS, or Okta to automatically collect evidence for your controls. Most teams complete their first integration in under 10 minutes.</p>
        <a href="${BASE_URL}/integrations" class="btn">Connect an integration →</a>
      `,
    },
    14: {
      subject: `Your compliance score is ready, ${name}`,
      body: `
        <h2>See where you stand</h2>
        <p>Hi ${name},</p>
        <p>After 2 weeks, your control assessments and integrations give us enough data to show your current compliance score and the top gaps to close.</p>
        <a href="${BASE_URL}/dashboard" class="btn">View your compliance score →</a>
      `,
    },
  };
  const msg = messages[opts.day];
  await send({
    to: opts.to,
    subject: msg.subject,
    tags: { type: `drip_day${opts.day}` },
    html: wrap(msg.body),
  });
}

export async function sendTrialExpiryEmail(opts: {
  to: string;
  firstName?: string;
  orgName?: string;
  daysLeft: number;
  trialEndsAt: Date;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const urgency = opts.daysLeft === 1 ? "URGENT: " : "";
  await send({
    to: opts.to,
    subject: `${urgency}Your EnterpriseComply trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`,
    tags: { type: `trial_expiry_${opts.daysLeft}d` },
    html: wrap(`
      <h2>Your trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}</h2>
      <p>Hi ${name},</p>
      <p>Your EnterpriseComply trial for <strong>${opts.orgName || "your organization"}</strong> expires on <strong>${opts.trialEndsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</p>
      <p>Upgrade now to keep your compliance posture intact and avoid disruption to your team.</p>
      <a href="${BASE_URL}/billing" class="btn">Upgrade your plan →</a>
    `),
  });
}

export async function sendTrialExpiredEmail(opts: {
  to: string;
  firstName?: string;
  orgName?: string;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  await send({
    to: opts.to,
    subject: "Your EnterpriseComply trial has ended",
    tags: { type: "trial_expired" },
    html: wrap(`
      <h2>Your trial has ended</h2>
      <p>Hi ${name},</p>
      <p>Your EnterpriseComply trial for <strong>${opts.orgName || "your organization"}</strong> has expired. Your data is safe, but access to the platform has been limited.</p>
      <p>Upgrade within 30 days to restore full access.</p>
      <a href="${BASE_URL}/billing" class="btn">Restore access →</a>
    `),
  });
}

export async function sendMagicLinkEmail(opts: {
  to: string;
  magicLink: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: 'Sign in to EnterpriseComply',
    tags: { type: 'magic_link' },
    html: wrap(`
<h2>Sign in to EnterpriseComply</h2>
<p>Click the button below to sign in. This link expires in 15 minutes.</p>
<a href="${opts.magicLink}" class="btn">Sign in →</a>
<p style="font-size:12px;color:#6b7280;margin-top:16px;">If you did not request this, you can safely ignore this email.</p>
`),
  });
}
