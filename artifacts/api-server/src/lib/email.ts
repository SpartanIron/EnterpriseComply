// EC lib/email.ts — transactional email service
// Nodemailer-based, SMTP-configured, matches C2S email quality standard
// Email types: welcome, onboarding drip (day3/7/14), trial expiry (7d/3d/1d), trial expired,
//   policy acknowledgment, policy reminder, control failure alert, vendor assessment invite

import nodemailer from "nodemailer";
import { logger } from "./logger";

// ── SMTP transport ────────────────────────────────────────────────────────
const FROM = process.env["SMTP_FROM"] || "EnterpriseComply <noreply@grc.colorcodesolutions.com>";
const REPLY_TO = process.env["SMTP_REPLY_TO"] || "support@grc.colorcodesolutions.com";
const BASE_URL = process.env["APP_URL"] || "https://grc.colorcodesolutions.com";

function createTransport() {
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
    logger.warn("[email] SMTP not configured — emails will be logged only");
    return null;
  }
  return nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass }, pool: true, maxConnections: 5,
  });
}

const transport = createTransport();

async function send(opts: {
  to: string; subject: string; html: string; text?: string; tags?: Record<string, string>;
}): Promise<void> {
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, "[email] SMTP not configured — skipping send");
    return;
  }
  try {
    await transport.sendMail({
      from: FROM, replyTo: REPLY_TO, to: opts.to, subject: opts.subject,
      html: opts.html, text: opts.text || opts.subject,
      headers: opts.tags ? Object.entries(opts.tags).reduce((acc, [k, v]) => ({ ...acc, [`X-EC-${k}`]: v }), {}) : undefined,
    });
    logger.info({ to: opts.to, subject: opts.subject }, "[email] sent");
  } catch (err) {
    logger.error({ err, to: opts.to, subject: opts.subject }, "[email] send failed");
    throw err;
  }
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:0;color:#111}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb}.logo{font-size:20px;font-weight:700;color:#1d4ed8;margin-bottom:24px}.btn{display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0}.btn-red{background:#dc2626}.footer{margin-top:32px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px}h2{font-size:22px;margin:0 0 16px}p{line-height:1.6;margin:0 0 12px}.alert-box{background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:16px 0}.warn-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px;margin:16px 0}.success-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:16px 0}ul{margin:0 0 12px;padding-left:20px}li{margin:4px 0}</style></head><body><div class="container"><div class="logo">EnterpriseComply</div>${body}<div class="footer">EnterpriseComply &mdash; GRC for the Enterprise &bull; <a href="${BASE_URL}">${BASE_URL.replace("https://","")}</a></div></div></body></html>`;
}

// ── Welcome ───────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(opts: { to: string; firstName?: string; orgName?: string; }): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const org = opts.orgName || "your organization";
  await send({
    to: opts.to,
    subject: `Welcome to EnterpriseComply, ${name}!`,
    tags: { type: "welcome" },
    html: wrap(`<h2>Welcome to EnterpriseComply!</h2><p>Hi ${name},</p><p>You've joined <strong>${org}</strong> on EnterpriseComply. Your GRC platform is ready to help you achieve and maintain compliance with FedRAMP, CMMC, SOC 2, ISO 27001, and more.</p><p>Here's what to do next:</p><ul><li>Complete your <strong>organization profile</strong></li><li>Choose your <strong>compliance frameworks</strong></li><li>Connect your first <strong>integration</strong></li></ul><a href="${BASE_URL}/dashboard" class="btn">Get started &rarr;</a>`),
  });
}

// ── Onboarding drip ───────────────────────────────────────────────────────
export async function sendOnboardingDripEmail(opts: { to: string; firstName?: string; day: 3 | 7 | 14; }): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const messages: Record<number, { subject: string; body: string }> = {
    3: { subject: `${name}, your compliance framework is waiting`, body: `<h2>3 days in — have you chosen your framework?</h2><p>Hi ${name},</p><p>Many teams start with <strong>CMMC Level 2</strong> or <strong>SOC 2 Type II</strong>. Our guided wizard maps your existing controls automatically.</p><a href="${BASE_URL}/frameworks" class="btn">Choose a framework &rarr;</a>` },
    7: { subject: `Connect your first integration, ${name}`, body: `<h2>Integrations unlock automated evidence</h2><p>Hi ${name},</p><p>Connect GitHub, AWS, or Okta to automatically collect evidence for your controls. Most teams complete their first integration in under 10 minutes.</p><a href="${BASE_URL}/integrations" class="btn">Connect an integration &rarr;</a>` },
    14: { subject: `Your compliance score is ready, ${name}`, body: `<h2>See where you stand</h2><p>Hi ${name},</p><p>After 2 weeks, your control assessments and integrations give us enough data to show your current compliance score and the top gaps to close.</p><a href="${BASE_URL}/dashboard" class="btn">View your compliance score &rarr;</a>` },
  };
  const msg = messages[opts.day];
  await send({ to: opts.to, subject: msg.subject, tags: { type: `drip_day${opts.day}` }, html: wrap(msg.body) });
}

// ── Trial expiry ──────────────────────────────────────────────────────────
export async function sendTrialExpiryEmail(opts: { to: string; firstName?: string; orgName?: string; daysLeft: number; trialEndsAt: Date; }): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const urgency = opts.daysLeft === 1 ? "URGENT: " : "";
  await send({
    to: opts.to,
    subject: `${urgency}Your EnterpriseComply trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`,
    tags: { type: `trial_expiry_${opts.daysLeft}d` },
    html: wrap(`<h2>Your trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}</h2><p>Hi ${name},</p><p>Your EnterpriseComply trial for <strong>${opts.orgName || "your organization"}</strong> expires on <strong>${opts.trialEndsAt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong>.</p><p>Upgrade now to keep your compliance posture intact.</p><a href="${BASE_URL}/billing" class="btn">Upgrade your plan &rarr;</a>`),
  });
}

export async function sendTrialExpiredEmail(opts: { to: string; firstName?: string; orgName?: string; }): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  await send({
    to: opts.to,
    subject: "Your EnterpriseComply trial has ended",
    tags: { type: "trial_expired" },
    html: wrap(`<h2>Your trial has ended</h2><p>Hi ${name},</p><p>Your EnterpriseComply trial for <strong>${opts.orgName || "your organization"}</strong> has expired. Your data is safe, but access to the platform has been limited.</p><p>Upgrade within 30 days to restore full access.</p><a href="${BASE_URL}/billing" class="btn">Restore access &rarr;</a>`),
  });
}

// ── Magic link ────────────────────────────────────────────────────────────
export async function sendMagicLinkEmail(opts: { to: string; magicLink: string; }): Promise<void> {
  await send({
    to: opts.to,
    subject: 'Sign in to EnterpriseComply',
    tags: { type: 'magic_link' },
    html: wrap(`<h2>Sign in to EnterpriseComply</h2><p>Click the button below to sign in. This link expires in 15 minutes.</p><a href="${opts.magicLink}" class="btn">Sign in &rarr;</a><p style="font-size:12px;color:#6b7280;margin-top:16px;">If you did not request this, you can safely ignore this email.</p>`),
  });
}

// ── Policy acknowledgment request ─────────────────────────────────────────
export async function sendPolicyAcknowledgmentEmail(opts: {
  to: string; firstName?: string; policyTitle: string; policyId: number; orgName?: string;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const ackUrl = `${BASE_URL}/policies?ack=${opts.policyId}`;
  await send({
    to: opts.to,
    subject: `Action required: Please acknowledge "${opts.policyTitle}"`,
    tags: { type: "policy_ack_request", policyId: String(opts.policyId) },
    html: wrap(`<h2>Policy Acknowledgment Required</h2><p>Hi ${name},</p><div class="warn-box"><strong>${opts.orgName || "Your organization"}</strong> requires you to review and acknowledge the following policy:</div><p style="font-size:18px;font-weight:600;margin:16px 0;">${opts.policyTitle}</p><p>Please review the policy and confirm your acknowledgment. This is required to maintain your organization's compliance posture.</p><a href="${ackUrl}" class="btn">Review &amp; Acknowledge &rarr;</a><p style="font-size:12px;color:#6b7280;margin-top:16px;">If you have questions about this policy, contact your compliance team.</p>`),
  });
}

// ── Policy acknowledgment reminder (overdue) ──────────────────────────────
export async function sendPolicyAckReminderEmail(opts: {
  to: string; firstName?: string; policyTitle: string; policyId: number;
  daysPending: number; orgName?: string;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const ackUrl = `${BASE_URL}/policies?ack=${opts.policyId}`;
  await send({
    to: opts.to,
    subject: `Reminder: "${opts.policyTitle}" acknowledgment overdue (${opts.daysPending} days)`,
    tags: { type: "policy_ack_reminder", policyId: String(opts.policyId) },
    html: wrap(`<h2>Policy Acknowledgment Overdue</h2><p>Hi ${name},</p><div class="alert-box">You have an <strong>overdue policy acknowledgment</strong> that has been pending for ${opts.daysPending} day${opts.daysPending === 1 ? "" : "s"}.</div><p style="font-size:18px;font-weight:600;margin:16px 0;">${opts.policyTitle}</p><p>Your compliance manager at <strong>${opts.orgName || "your organization"}</strong> requires this acknowledgment to maintain your compliance records. Please acknowledge as soon as possible.</p><a href="${ackUrl}" class="btn btn-red">Acknowledge Now &rarr;</a>`),
  });
}

// ── Control failure alert ─────────────────────────────────────────────────
export async function sendControlFailureEmail(opts: {
  to: string; firstName?: string; orgName?: string;
  failingControls: Array<{ id: string; name: string; integrationKey?: string }>;
  integrationKey: string;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const controlList = opts.failingControls
    .map(c => `<li><strong>${c.id}</strong> — ${c.name}${c.integrationKey ? ` <span style="color:#6b7280;font-size:12px;">(${c.integrationKey})</span>` : ""}</li>`)
    .join("");
  await send({
    to: opts.to,
    subject: `🔴 ${opts.failingControls.length} control${opts.failingControls.length === 1 ? "" : "s"} failed — ${opts.integrationKey} sync`,
    tags: { type: "control_failure", integrationKey: opts.integrationKey },
    html: wrap(`<h2>Compliance Controls Failed</h2><p>Hi ${name},</p><div class="alert-box">The <strong>${opts.integrationKey}</strong> integration sync detected <strong>${opts.failingControls.length} failing control${opts.failingControls.length === 1 ? "" : "s"}</strong> for <strong>${opts.orgName || "your organization"}</strong>.</div><p><strong>Failing controls:</strong></p><ul>${controlList}</ul><p>Review and remediate these issues to maintain your compliance posture.</p><a href="${BASE_URL}/controls" class="btn btn-red">View Failing Controls &rarr;</a><a href="${BASE_URL}/remediation" class="btn" style="margin-left:8px;">Open Remediation Board &rarr;</a>`),
  });
}

// ── Evidence expiry warning ────────────────────────────────────────────────
export async function sendEvidenceExpiryEmail(opts: {
  to: string; firstName?: string; orgName?: string;
  expiringItems: Array<{ title: string; controlId?: string; daysUntilExpiry: number }>;
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const itemList = opts.expiringItems
    .map(e => `<li><strong>${e.title}</strong>${e.controlId ? ` (${e.controlId})` : ""} — expires in ${e.daysUntilExpiry} day${e.daysUntilExpiry === 1 ? "" : "s"}</li>`)
    .join("");
  await send({
    to: opts.to,
    subject: `⚠️ ${opts.expiringItems.length} evidence item${opts.expiringItems.length === 1 ? "" : "s"} expiring soon`,
    tags: { type: "evidence_expiry" },
    html: wrap(`<h2>Evidence Items Expiring Soon</h2><p>Hi ${name},</p><div class="warn-box">${opts.expiringItems.length} evidence item${opts.expiringItems.length === 1 ? "" : "s"} for <strong>${opts.orgName || "your organization"}</strong> will expire within 7 days.</div><p><strong>Items requiring renewal:</strong></p><ul>${itemList}</ul><p>Refresh these evidence items to prevent controls from failing.</p><a href="${BASE_URL}/evidence" class="btn">Manage Evidence &rarr;</a>`),
  });
}

// ── Vendor assessment invite ───────────────────────────────────────────────
export async function sendVendorAssessmentEmail(opts: {
  to: string; vendorName: string; requesterOrgName: string;
  templateType: string; dueDate?: Date; assessmentId: number;
}): Promise<void> {
  const due = opts.dueDate
    ? opts.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "at your earliest convenience";
  const responseUrl = `${BASE_URL}/vendor-response/${opts.assessmentId}`;
  await send({
    to: opts.to,
    subject: `Security Assessment Request from ${opts.requesterOrgName}`,
    tags: { type: "vendor_assessment", assessmentId: String(opts.assessmentId) },
    html: wrap(`<h2>Security Assessment Request</h2><p>Dear ${opts.vendorName} team,</p><p><strong>${opts.requesterOrgName}</strong> is requesting a security assessment as part of their vendor risk management program.</p><div class="warn-box"><strong>Template:</strong> ${opts.templateType.toUpperCase()}<br/><strong>Response due:</strong> ${due}</div><p>Please complete the assessment questionnaire by following the link below. Your responses will be kept confidential and used only for vendor risk evaluation.</p><a href="${responseUrl}" class="btn">Complete Assessment &rarr;</a><p style="font-size:12px;color:#6b7280;margin-top:16px;">If you have questions, reply to this email and we'll connect you with the requester.</p>`),
  });
}

// ── HR sync: new hire onboarding ──────────────────────────────────────────
export async function sendNewHireComplianceEmail(opts: {
  to: string; firstName?: string; orgName?: string;
  trainingUrl?: string; policiesToAck: string[];
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const policyList = opts.policiesToAck.length > 0
    ? `<p><strong>Policies requiring your acknowledgment:</strong></p><ul>${opts.policiesToAck.map(p => `<li>${p}</li>`).join("")}</ul>`
    : "";
  await send({
    to: opts.to,
    subject: `Welcome to ${opts.orgName || "the team"} — compliance onboarding required`,
    tags: { type: "new_hire_compliance" },
    html: wrap(`<h2>Compliance Onboarding</h2><p>Hi ${name},</p><div class="success-box">Welcome to <strong>${opts.orgName || "the organization"}</strong>! To complete your onboarding, please complete the required compliance tasks below.</div>${policyList}${opts.trainingUrl ? `<p><strong>Required training:</strong></p><p>Please complete your security awareness training as part of your onboarding requirements.</p><a href="${opts.trainingUrl}" class="btn">Start Security Training &rarr;</a>` : ""}<a href="${BASE_URL}/dashboard" class="btn" style="margin-top:8px;">View Compliance Dashboard &rarr;</a>`),
  });
}

// ── Posture score change notification ─────────────────────────────────────
export async function sendPostureScoreChangeEmail(opts: {
  to: string; firstName?: string; orgName?: string;
  previousScore: number; currentScore: number; delta: number;
  topFailingControls: string[];
}): Promise<void> {
  const name = opts.firstName || opts.to.split("@")[0];
  const direction = opts.delta >= 0 ? "improved" : "dropped";
  const dirIcon = opts.delta >= 0 ? "✅" : "🔴";
  const controlList = opts.topFailingControls.length > 0
    ? `<p><strong>Top failing controls:</strong></p><ul>${opts.topFailingControls.map(c => `<li>${c}</li>`).join("")}</ul>`
    : "";
  await send({
    to: opts.to,
    subject: `${dirIcon} Compliance score ${direction} ${Math.abs(opts.delta)} pts — ${opts.orgName || "your org"}`,
    tags: { type: "posture_change" },
    html: wrap(`<h2>Compliance Posture Change</h2><p>Hi ${name},</p><div class="${opts.delta >= 0 ? "success-box" : "alert-box"}">Your compliance score for <strong>${opts.orgName || "your organization"}</strong> has <strong>${direction} by ${Math.abs(opts.delta)} points</strong>.<br/><strong>${opts.previousScore}%</strong> &rarr; <strong>${opts.currentScore}%</strong></div>${controlList}<a href="${BASE_URL}/dashboard" class="btn">View Dashboard &rarr;</a><a href="${BASE_URL}/controls" class="btn" style="margin-left:8px;">Review Controls &rarr;</a>`),
  });
}
