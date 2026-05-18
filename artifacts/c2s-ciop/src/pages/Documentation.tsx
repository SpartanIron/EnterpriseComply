import { useState } from "react";

// ─── Icon helpers ─────────────────────────────────────────────────────────────
const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS: Record<string, string> = {
  book:     "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  question: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  rocket:   "M13 10V3L4 14h7v7l9-11h-7z",
  shield:   "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  cog:      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  chart:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  doc:      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  user:     "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  check:    "M5 13l4 4L19 7",
  plus:     "M12 4v16m8-8H4",
  link:     "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  flag:     "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
  lock:     "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  globe:    "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: "rocket" },
  { id: "dashboard",       label: "Dashboard",       icon: "chart" },
  { id: "controls",        label: "Controls",        icon: "shield" },
  { id: "policies",        label: "Policies",        icon: "doc" },
  { id: "evidence",        label: "Evidence & Integrations", icon: "link" },
  { id: "risk",            label: "Risk Register",   icon: "warning" },
  { id: "workforce",       label: "Workforce",       icon: "user" },
  { id: "questionnaires",  label: "Questionnaires",  icon: "question" },
  { id: "remediation",     label: "Remediation Board", icon: "flag" },
  { id: "federal",         label: "Federal Compliance", icon: "globe" },
  { id: "zero-trust",      label: "Zero Trust Assessment", icon: "shield" },
  { id: "conmon",          label: "ConMon Program",        icon: "activity" },
  { id: "crosswalk",       label: "Control Crosswalk",     icon: "grid" },
  { id: "test-runs",       label: "Test Run History", icon: "check" },
  { id: "assets",          label: "Asset Inventory", icon: "lock" },
  { id: "settings",        label: "Settings & Admin", icon: "cog" },
    { id: "vuln-management",  label: "Vulnerability Mgmt",   icon: "warning" },
  { id: "fisma-reporting",  label: "FISMA Reporting",      icon: "flag" },
  { id: "poam",             label: "POA\u0026M",             icon: "doc" },
  { id: "sprs",             label: "SPRS Score",           icon: "chart" },
  { id: "ssp",              label: "SSP Generator",        icon: "doc" },
  { id: "stigs",            label: "STIG Findings",        icon: "shield" },
  { id: "system-boundary",  label: "System Boundary",      icon: "globe" },
  { id: "nist-800-171",     label: "NIST 800-171 Rev 3",   icon: "check" },
  { id: "monitoring",       label: "Monitoring",           icon: "activity" },
  { id: "vendors",          label: "Vendors",              icon: "user" },
  { id: "trust-center",     label: "Trust Center",         icon: "lock" },
  { id: "audit-log",        label: "Audit Log",            icon: "book" },
  { id: "faq",             label: "FAQ",             icon: "question" },
  { id: "glossary",        label: "Glossary",        icon: "book" },
];

const SECTIONS: Record<string, { title: string; content: React.ReactNode }> = {};

// ─── Sub-components ───────────────────────────────────────────────────────────
function CalloutBox({ type, children }: { type: "tip" | "warning" | "info"; children: React.ReactNode }) {
  const cfg = {
    tip:     { bg: "bg-green-50 border-green-200",  icon: "check",   iconCls: "text-green-600",  label: "Tip" },
    warning: { bg: "bg-amber-50 border-amber-200",   icon: "warning", iconCls: "text-amber-600",  label: "Note" },
    info:    { bg: "bg-blue-50 border-blue-200",     icon: "info",    iconCls: "text-blue-600",   label: "Info" },
  }[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${cfg.bg} my-4`}>
      <Icon d={ICONS[cfg.icon]} className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.iconCls}`} />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: { num: number; title: string; body: string }[] }) {
  return (
    <ol className="space-y-4 my-4">
      {steps.map(s => (
        <li key={s.num} className="flex gap-4">
          <span className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{s.num}</span>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
            <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-100">{children}</h3>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-bold text-slate-800 mt-5 mb-2">{children}</h4>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 my-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-600">
          <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm pr-4">{q}</span>
        <svg className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

function GlossaryTerm({ term, def }: { term: string; def: string }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <span className="font-semibold text-slate-900 text-sm">{term}</span>
      <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{def}</p>
    </div>
  );
}

// ─── Section content renderers ────────────────────────────────────────────────
function GettingStarted() {
  return (
    <div>
      <Para>EnterpriseComply is a GRC (Governance, Risk, and Compliance) automation platform purpose-built for small and mid-sized organizations pursuing SOC 2, ISO 27001, CMMC, FedRAMP, and other security certifications. This guide walks you from zero to a fully operational compliance program in under 30 minutes.</Para>
      <SectionHeading>Quickstart - 5 Steps to Compliance</SectionHeading>
      <StepList steps={[
        { num: 1, title: "Create your account & organization", body: "Sign up at app.enterprisecomply.com. You'll be prompted to enter your organization name, industry, and employee count during onboarding. This seeds your initial control library and risk profile." },
        { num: 2, title: "Add a compliance framework", body: "Navigate to Compliance → Frameworks and click '+ Add framework'. Select SOC 2, ISO 27001, CMMC, FedRAMP, NIST CSF, or a custom framework. EnterpriseComply maps all applicable controls automatically - no manual work required." },
        { num: 3, title: "Connect your first integration", body: "Go to Evidence → Integrations and connect GitHub, AWS, Okta, or any of the 60+ supported integrations. Each connection immediately starts collecting evidence and testing controls. Most integrations take under 2 minutes to set up." },
        { num: 4, title: "Review your control status", body: "Visit Compliance → Controls to see which controls are passing, failing, or untested. Use the AI Gap Analysis to generate a prioritized remediation plan. The Remediation Board organizes failing controls into a Kanban board for your team." },
        { num: 5, title: "Build your policy library", body: "Navigate to Workforce → Policies and click '+ Add Policy'. Choose from 30+ professionally drafted templates (Acceptable Use, Incident Response, Access Control, etc.). Publish policies and send acknowledgment requests to your team." },
      ]} />
      <CalloutBox type="tip">The Getting Started checklist on your Dashboard tracks your progress. Complete all 5 steps to reach 100% onboarding and unlock your compliance posture score.</CalloutBox>
      <SectionHeading>Platform Overview</SectionHeading>
      <Para>EnterpriseComply is organized into six main areas accessible from the left navigation:</Para>
      <BulletList items={[
        "Overview - Dashboard with your live posture score, control summary, and onboarding checklist",
        "Compliance - Frameworks, Controls, Risk Register, Remediation Board, and AI Gap Analysis",
        "Evidence - Integrations, Evidence Vault, Test Run History, and Monitoring",
        "Workforce - Policies, People roster, Access Reviews, and Vendor management",
        "Audit & Sales - Auditor Portal, Security Questionnaires, Client Assessments, and Trust Center",
        "Federal - POA&M, SPRS Score, System Security Plan (SSP), and STIG Findings",
      ]} />
      <SectionHeading>User Roles</SectionHeading>
      <BulletList items={[
        "Admin - Full access including settings, billing, and user management",
        "Owner - Same as Admin; typically the CISO or compliance lead",
        "Member - Can view and update controls, evidence, and policies; cannot change org settings",
        "Auditor - Read-only access via the Auditor Portal; cannot modify any data",
      ]} />
      <CalloutBox type="info">Role management is available in Settings → Team. Each user can only belong to one organization at a time.</CalloutBox>
    </div>
  );
}

function DashboardGuide() {
  return (
    <div>
      <Para>The Dashboard is your real-time compliance command center. It aggregates data from all connected integrations and gives you an at-a-glance view of your security posture.</Para>
      <SectionHeading>Posture Score</SectionHeading>
      <Para>The circular score (0-100) in the header represents your overall compliance health. It is calculated as a weighted average of: passing controls (60%), published policies (20%), and connected integrations (20%). A score above 80 is considered audit-ready for most frameworks.</Para>
      <SectionHeading>Stat Cards</SectionHeading>
      <BulletList items={[
        "Passing Controls - Total controls currently evidenced as passing across all active frameworks",
        "Failing Controls - Controls with failing evidence that require remediation action",
        "Not Tested - Controls with no evidence collected yet - connect integrations to test them automatically",
        "Integrations Active - Number of integrations actively collecting evidence / total available",
      ]} />
      <SectionHeading>Getting Started Checklist</SectionHeading>
      <Para>The checklist tracks your five onboarding milestones. Each item links directly to the relevant page. The progress bar fills as you complete each step. Once all five are complete, the checklist collapses into a 'Completed' summary.</Para>
      <SectionHeading>C2S Intel Panel</SectionHeading>
      <Para>If your organization is connected to C2S Intel (the federal opportunity intelligence platform), a panel at the bottom of the Dashboard displays upcoming contract opportunities, CAGE code lookup, and SAM.gov links relevant to your compliance certifications.</Para>
      <SectionHeading>Board Report</SectionHeading>
      <Para>Click 'Board Report (PDF)' to download a formatted executive summary of your compliance posture - suitable for presenting to your board, investors, or enterprise procurement reviewers.</Para>
    </div>
  );
}

function ControlsGuide() {
  return (
    <div>
      <Para>Controls are the security requirements that frameworks like SOC 2 and ISO 27001 mandate you implement. EnterpriseComply uses a Universal Control Object (UCO) library that maps a single control to multiple frameworks simultaneously - implement once, satisfy many.</Para>
      <SectionHeading>Control Statuses</SectionHeading>
      <BulletList items={[
        "Passing - Evidence has been collected confirming the control is implemented and functioning",
        "Failing - Evidence was collected but the control did not meet the required threshold",
        "Not Tested - No evidence has been collected yet; requires integration connection or manual override",
        "Warning - Evidence collected but a non-critical issue was detected",
      ]} />
      <SectionHeading>How to Mark a Control</SectionHeading>
      <StepList steps={[
        { num: 1, title: "Navigate to Compliance → Controls", body: "Controls are grouped by security domain (Access Control, Data Protection, Incident Response, etc.)." },
        { num: 2, title: "Expand a control row", body: "Click any control row to expand its detail panel showing description, objective, remediation guidance, and test result." },
        { num: 3, title: "Assign an owner", body: "Click 'Assign owner' to set a responsible person and due date. This shows on the Remediation Board for tracking." },
        { num: 4, title: "Set a manual override", body: "If you've implemented a control outside the automated testing pipeline, click 'Set manual override', select the status, and add your justification notes. Manual overrides are flagged separately in audit exports." },
      ]} />
      <SectionHeading>Automated Testing</SectionHeading>
      <Para>When an integration is connected, EnterpriseComply runs automated tests against that integration daily. For example, connecting GitHub checks branch protection rules, code review enforcement, and Dependabot alerts automatically. Results appear in Evidence → Test Run History.</Para>
      <CalloutBox type="tip">Click 'Run Tests Now' on the Test Run History page to trigger an immediate test sweep across all connected integrations - useful before an audit.</CalloutBox>
      <SectionHeading>Framework Impact Modal</SectionHeading>
      <Para>When you mark a control as Passing, the platform shows a cascade impact modal listing every framework requirement satisfied by that single control. This demonstrates the ROI of the UCO approach - one control can satisfy 5-15 requirements across SOC 2, ISO 27001, CMMC, and NIST simultaneously.</Para>
    </div>
  );
}

function PoliciesGuide() {
  return (
    <div>
      <Para>The Policy Library is where you manage your organization's security policies. EnterpriseComply ships with 30+ professionally drafted policy templates mapped to SOC 2, ISO 27001, CMMC, HIPAA, GDPR, and FedRAMP requirements.</Para>
      <SectionHeading>Policy Lifecycle</SectionHeading>
      <Para>Every policy moves through a four-stage lifecycle:</Para>
      <BulletList items={[
        "Draft - Policy created from template; editable, not yet visible to staff",
        "Review Required - Policy flagged for legal or compliance team review before publishing",
        "Published - Active policy; staff can be sent acknowledgment requests",
        "Archived - Retired policy; retained for audit trail purposes",
      ]} />
      <SectionHeading>How to Add a Policy</SectionHeading>
      <StepList steps={[
        { num: 1, title: "Click '+ Add Policy'", body: "Opens the template browser organized by category: Security, Privacy, Human Resources, Operations, Compliance, and Federal." },
        { num: 2, title: "Select a template", body: "Click any template to instantly create a draft policy with full professional content. Templates include purpose, scope, requirements, roles & responsibilities, enforcement, and review cycle sections." },
        { num: 3, title: "Review and publish", body: "From the policy table, click 'Publish' to move the policy to Published status. Only published policies can be sent for acknowledgment." },
        { num: 4, title: "Track acknowledgments", body: "Click 'Acks' on any published policy to open the acknowledgment panel. Select a team member from your People roster and click 'Record' to log their acknowledgment. Use 'Request All' to send an automated acknowledgment request to all people." },
      ]} />
      <SectionHeading>Available Policy Templates</SectionHeading>
      <SubHeading>Security (12 templates)</SubHeading>
      <BulletList items={[
        "Acceptable Use Policy - Governs appropriate use of company systems, devices, and data",
        "Information Security Policy - Master policy defining the overall security program",
        "Access Control Policy - Principles for granting, reviewing, and revoking access",
        "Password Policy - Password complexity, rotation, and manager requirements",
        "Encryption Policy - Standards for encrypting data at rest and in transit",
        "Incident Response Policy - Detection, containment, eradication, and recovery procedures",
        "Incident Response Plan - Detailed runbook with roles, escalation paths, and communication templates",
        "Vulnerability Management Policy - Scanning frequency, severity SLAs, and patch management",
        "Change Management Policy - Approval workflows for production system changes",
        "Endpoint Security Policy - Requirements for laptops, mobile devices, and remote access",
        "Network Security Policy - Firewall rules, segmentation, and monitoring requirements",
        "Penetration Testing Policy - Frequency, scope, and remediation SLAs for pen tests",
      ]} />
      <SubHeading>Privacy (5 templates)</SubHeading>
      <BulletList items={[
        "Data Classification Policy - Public, Internal, Confidential, and Restricted data handling rules",
        "Privacy Policy - Customer-facing data collection, use, and rights disclosure",
        "Data Retention Policy - Retention schedules and secure deletion procedures",
        "Data Breach Notification Policy - Timelines and procedures for breach disclosure",
        "GDPR Data Processing Policy - Lawful basis, data subject rights, and processor agreements",
      ]} />
      <SubHeading>Human Resources (4 templates)</SubHeading>
      <BulletList items={[
        "Background Check Policy - Pre-employment screening requirements for sensitive roles",
        "Security Awareness Training Policy - Mandatory training frequency and topic coverage",
        "Employee Onboarding Security Checklist - Day-one security setup and acknowledgments",
        "Employee Offboarding Policy - Access revocation and equipment return timelines",
      ]} />
      <SubHeading>Operations (6 templates)</SubHeading>
      <BulletList items={[
        "Business Continuity Plan - RTO/RPO objectives and recovery strategies",
        "Disaster Recovery Policy - Backup procedures, testing schedules, and failover processes",
        "Third-Party Risk Management Policy - Vendor assessment and ongoing monitoring requirements",
        "Software Development Lifecycle (SDLC) Security Policy - Secure coding and code review standards",
        "Asset Management Policy - Inventory, classification, and disposal of IT assets",
        "Audit Logging Policy - Log collection, retention, and integrity requirements",
      ]} />
      <SubHeading>Compliance (2 templates)</SubHeading>
      <BulletList items={[
        "Risk Management Policy - Risk identification, assessment, and treatment procedures",
        "Compliance Management Policy - Framework management, evidence collection, and audit readiness",
      ]} />
      <SubHeading>Federal (1 template)</SubHeading>
      <BulletList items={[
        "System Security Plan Policy (FedRAMP/FISMA) - SSP maintenance, update cycles, and authorization boundaries",
      ]} />
      <SectionHeading>Acknowledgment Tracking</SectionHeading>
      <Para>Auditors frequently request evidence that employees have read and acknowledged security policies. EnterpriseComply logs each acknowledgment with a timestamp and records it against the policy version. When you publish a new version of a policy, prior acknowledgments are retained and new acknowledgments can be requested for the updated version.</Para>
      <CalloutBox type="warning">SOC 2 requires evidence that security policies have been communicated to and acknowledged by all personnel with access to in-scope systems. Aim for 100% acknowledgment on Published policies before your audit window opens.</CalloutBox>
    </div>
  );
}

function EvidenceGuide() {
  return (
    <div>
      <Para>The Evidence module is where EnterpriseComply automatically collects and stores proof that your security controls are working. Evidence comes from two sources: automated integration checks and manually uploaded files.</Para>
      <SectionHeading>Integrations</SectionHeading>
      <Para>EnterpriseComply supports 60+ integrations across all major security tool categories:</Para>
      <BulletList items={[
        "Cloud Security - AWS Config, AWS GuardDuty, Microsoft Defender for Cloud, GCP Security Command Center, Prisma Cloud, Orca Security, Lacework",
        "CI/CD - GitHub Actions, CircleCI, Jenkins, GitLab CI",
        "Container - Kubernetes, Amazon ECR, Google Container Registry",
        "Identity - PingIdentity, Auth0, SailPoint, Okta",
        "PAM - CyberArk, BeyondTrust",
        "Secrets - AWS Secrets Manager, Azure Key Vault",
        "SIEM - Elastic SIEM, Splunk",
        "Application Security - Veracode, Checkmarx",
        "HRIS - ADP Workforce Now, Gusto",
        "Collaboration - Microsoft Teams, Zoom, Slack",
        "Recruiting - Greenhouse",
        "ERP - NetSuite",
        "Customer Support - Zendesk",
      ]} />
      <SectionHeading>How to Connect an Integration</SectionHeading>
      <StepList steps={[
        { num: 1, title: "Go to Evidence → Integrations", body: "The integration catalog shows all available integrations with their category, sync frequency, and connection status." },
        { num: 2, title: "Click 'Connect' on the desired integration", body: "Each integration has a Guide button that opens step-by-step setup instructions specific to that tool." },
        { num: 3, title: "Authorize the connection", body: "OAuth-based integrations (GitHub, Google Workspace) open an authorization flow. API key integrations prompt for your key and optional configuration." },
        { num: 4, title: "Wait for initial sync", body: "Most integrations complete their first sync within 60-90 seconds. The Sync status shows elapsed time and records collected." },
        { num: 5, title: "Review evidence", body: "Navigate to Evidence Vault to see all collected evidence items, or check Controls to see which controls are now passing." },
      ]} />
      <SectionHeading>Evidence Vault</SectionHeading>
      <Para>The Evidence Vault stores all collected evidence items with metadata: source integration, collection date, associated control, and evidence type. During an audit, you can filter evidence by framework, date range, or control domain and export a ZIP package for your auditor.</Para>
      <SectionHeading>Manual Evidence Upload</SectionHeading>
      <Para>Not everything can be automated. For controls that require human-generated artifacts (penetration test reports, board meeting minutes, insurance certificates), use the Evidence Vault upload function. Attach a file, tag it to one or more controls, and add a description.</Para>
      <CalloutBox type="tip">Evidence collected via automated integrations is timestamped, cryptographically verifiable, and harder for auditors to challenge than manually uploaded documents. Maximize your integration coverage before relying on manual uploads.</CalloutBox>
    </div>
  );
}

// --- Content -------------------------------------------------------
const CONTENT: Record<string, { title: string; intro: string; sections: { heading: string; body: string; tips?: string[]; steps?: string[] }[] }> = {
  "getting-started": {
    title: "Getting Started",
    intro: "Welcome to EnterpriseComply - the unified GRC platform built for DoD contractors, federal vendors, and cloud-native organizations pursuing CMMC, FedRAMP, and SOC 2 compliance.",
    sections: [
      {
        heading: "Prerequisites",
        body: "Before you begin, make sure you have: an active EnterpriseComply organization account, administrator or compliance-manager role assigned, and your NAICS codes and cage code handy for federal framework alignment.",
        steps: [
          "Receive your invitation email and click Accept Invitation",
          "Set a strong password and enable MFA under Settings → Security",
          "Complete your Organization Profile (name, CAGE code, NAICS codes, entity type)",
          "Select your target compliance frameworks (CMMC Level 1/2/3, FedRAMP Moderate/High, SOC 2 Type II, ISO 27001)",
          "Invite your team members via Settings → Users → Invite User"
        ]
      },
      {
        heading: "First-Time Setup",
        body: "After logging in for the first time, the platform will guide you through a brief onboarding wizard. Complete each step to unlock the full compliance dashboard.",
        steps: [
          "Connect at least one evidence source (GitHub, AWS, Okta, or upload manually)",
          "Import or create your first policy from the Policy Library",
          "Run your initial control assessment to establish a compliance baseline",
          "Assign owners to controls with open findings",
          "Schedule your first automated test run"
        ],
        tips: [
          "Start with CMMC Level 1 if you handle FCI but not CUI - it has only 17 practices",
          "Use the bulk-import feature in Asset Inventory to bring in your system boundary assets from a spreadsheet",
          "Link your GitHub repo to auto-populate CI/CD evidence with zero manual uploads"
        ]
      },
      {
        heading: "Navigating the Platform",
        body: "EnterpriseComply is organized into functional modules accessible from the left sidebar. Each module corresponds to a GRC domain: controls, policies, evidence, risk, workforce, questionnaires, and remediation.",
        tips: [
          "Use the global search bar (top of any page) to find controls, policies, or assets by keyword",
          "Breadcrumbs at the top of each page show your current location",
          "Click the question-mark icon in any panel to open contextual help"
        ]
      }
    ]
  },
  "dashboard": {
    title: "Dashboard",
    intro: "The Dashboard provides a real-time view of your compliance posture across all active frameworks. Scores are calculated automatically from control assessments, evidence freshness, and open findings.",
    sections: [
      {
        heading: "Compliance Score",
        body: "Your overall score (0-100) is a weighted average of control pass rates across all active frameworks. Controls with critical severity carry more weight than low-severity controls.",
        tips: [
          "A score above 85 is generally considered audit-ready for most frameworks",
          "Score drops are usually caused by expired evidence - check the Evidence page for items needing refresh",
          "Filter by framework using the dropdown at the top-right of the score card"
        ]
      },
      {
        heading: "Open Findings",
        body: "Findings are controls that are currently failing or have no evidence attached. The dashboard shows counts by severity: Critical, High, Medium, and Low. Click any severity badge to jump to the filtered Remediation Board.",
      },
      {
        heading: "Evidence Freshness",
        body: "Evidence items have configurable freshness windows (e.g., 90 days for access reviews). The dashboard highlights stale evidence so you can re-collect before it affects your score.",
      },
      {
        heading: "Framework Coverage",
        body: "The framework bar chart shows how many controls are passing vs. failing for each active framework. Use this to prioritize effort toward your most urgent compliance deadline.",
      }
    ]
  },
  "controls": {
    title: "Controls Library",
    intro: "The Controls Library is the heart of EnterpriseComply. Every compliance requirement - whether from CMMC, NIST 800-53, ISO 27001, or SOC 2 - is mapped to a structured control with evidence requirements, test criteria, and owner assignment.",
    sections: [
      {
        heading: "Marking Controls Passing or Failing",
        body: "Navigate to Controls, find the control you want to update, and click its row to open the detail panel. Use the Mark Passing or Mark Failing buttons at the bottom of the panel.",
        steps: [
          "Open Controls from the sidebar",
          "Use the search bar or framework filter to find the control",
          "Click the control row to open the side panel",
          "Review attached evidence and current status",
          "Click Mark Passing (with an override justification if required) or Mark Failing"
        ],
        tips: [
          "Passing overrides require a written justification that is stored in the audit log",
          "Failing a control automatically creates a remediation ticket on the Remediation Board",
          "Auto-test results (from connected integrations) will override manual status when fresh"
        ]
      },
      {
        heading: "Assigning Control Owners",
        body: "Every control should have an assigned owner responsible for maintaining compliance. Open the control detail panel and use the Owner field to select a user from your organization.",
      },
      {
        heading: "Filtering and Searching",
        body: "Use the framework dropdown, domain filter, status filter (passing/failing/unknown), and severity filter together to narrow down large control sets.",
        tips: [
          "Save frequently-used filter combinations using the bookmark icon",
          "Export filtered results to CSV for offline review or auditor sharing"
        ]
      }
    ]
  },
  "policies": {
    title: "Policy Library",
    intro: "The Policy Library provides pre-built, fully editable policy templates aligned to CMMC, NIST 800-53, FedRAMP, SOC 2, ISO 27001, and HIPAA. Each policy includes purpose, scope, roles and responsibilities, procedures, and enforcement sections.",
    sections: [
      {
        heading: "Adding a Policy from Template",
        body: "EnterpriseComply includes 20+ policy templates ready to customize. To add a policy:",
        steps: [
          "Navigate to Policies in the sidebar",
          "Click Add Policy → Browse Templates",
          "Select a template (e.g., Acceptable Use Policy, Incident Response Policy)",
          "Review the pre-filled content and customize for your organization",
          "Set the Owner, Review Frequency, and Effective Date",
          "Click Save to create the policy in Draft status"
        ]
      },
      {
        heading: "Policy Lifecycle",
        body: "Policies move through a defined lifecycle: Draft → Review Required → Approved → Active → Archived. Each transition is logged with a timestamp and the user who made the change.",
        tips: [
          "Set a review frequency (annually, semi-annually) so the system automatically flags policies for re-review",
          "Only Compliance Managers and Admins can approve policies",
          "Archived policies remain searchable but don't count toward compliance score"
        ]
      },
      {
        heading: "Acknowledgment Tracking",
        body: "Once a policy is Active, you can send it to workforce members for acknowledgment. The Workforce page shows per-person acknowledgment status.",
        steps: [
          "Open the policy and click Require Acknowledgment",
          "Select the user groups who must acknowledge",
          "Set a deadline for acknowledgment",
          "Track status under Workforce → Acknowledgments"
        ]
      }
    ]
  },
  "evidence": {
    title: "Evidence & Integrations",
    intro: "Evidence is the proof that your controls are operating as intended. EnterpriseComply can collect evidence automatically from 30+ integrations or accept manual uploads in any format.",
    sections: [
      {
        heading: "Connecting an Integration",
        body: "Navigate to Integrations from the Settings menu or the Evidence page. Click Connect next to the tool you use (GitHub, AWS, Okta, Jira, etc.) and follow the OAuth or API key flow.",
        steps: [
          "Go to Settings → Integrations",
          "Click Connect next to your tool",
          "Authorize access (OAuth) or enter your API credentials",
          "Select which workspaces, repos, or accounts to monitor",
          "Set the sync schedule (real-time, daily, weekly)",
          "Click Save - initial sync begins immediately"
        ],
        tips: [
          "GitHub Actions integration automatically pulls CI/CD run logs as SDLC evidence",
          "AWS Config integration pulls resource compliance findings directly into controls",
          "Okta integration populates workforce access reviews automatically"
        ]
      },
      {
        heading: "Manual Evidence Upload",
        body: "For tools without a native integration, upload screenshots, PDFs, or exports directly to any control's evidence panel.",
        steps: [
          "Open a control's detail panel",
          "Click Add Evidence → Upload File",
          "Select your file (PDF, PNG, CSV, etc.)",
          "Add a description and set the evidence date",
          "Click Save"
        ]
      },
      {
        heading: "Evidence Freshness",
        body: "Each evidence item has a configured freshness window. When evidence expires, the associated control is flagged and your compliance score may drop.",
        tips: [
          "Set reminder notifications before evidence expires under Settings → Notifications",
          "Use the Evidence dashboard view to see all items sorted by expiry date",
          "Connected integrations re-collect evidence automatically according to their sync schedule"
        ]
      }
    ]
  },
  "risk": {
    title: "Risk Register",
    intro: "The Risk Register helps you identify, assess, and track information security and compliance risks. Each risk entry includes likelihood, impact, inherent score, treatment plan, and residual score after controls are applied.",
    sections: [
      {
        heading: "Creating a Risk Entry",
        body: "Click Add Risk from the Risk Register page. Fill in the risk title, description, affected assets, and select the risk category (Technical, Operational, Legal, Vendor, etc.).",
        steps: [
          "Navigate to Risk Register in the sidebar",
          "Click Add Risk",
          "Enter risk title and description",
          "Select category and affected assets",
          "Set Likelihood (1-5) and Impact (1-5)",
          "Review the automatically calculated Inherent Risk Score",
          "Select a treatment plan: Accept, Mitigate, Transfer, or Avoid",
          "Assign an owner and target resolution date"
        ]
      },
      {
        heading: "Risk Scoring",
        body: "Risk scores are calculated as Likelihood × Impact on a 5×5 matrix. Scores 1-5 are Low, 6-12 are Medium, 13-19 are High, and 20-25 are Critical.",
        tips: [
          "Residual risk score is recalculated automatically when linked mitigating controls change status",
          "Use the heat map view to visualize your risk portfolio at a glance",
          "Export the risk register as a CSV or PDF for board reporting"
        ]
      },
      {
        heading: "Treatment Plans",
        body: "Each risk should have a documented treatment plan. Mitigate: add controls to reduce likelihood or impact. Transfer: use insurance or a vendor. Accept: document acceptance with management sign-off. Avoid: eliminate the activity causing the risk.",
      }
    ]
  },
  "workforce": {
    title: "Workforce",
    intro: "The Workforce module tracks your people roster, security training completion, policy acknowledgments, and access reviews in one place.",
    sections: [
      {
        heading: "People Roster",
        body: "The People tab shows all users in your organization with their roles, departments, employment status, and last-active date. Use the import button to bulk-import from a CSV or sync from an HR integration (ADP, Gusto).",
      },
      {
        heading: "Security Training",
        body: "Track mandatory annual security awareness training and any specialized training (ITAR, CUI handling). The Training tab shows completion status per person with due dates and completion certificates.",
        steps: [
          "Assign a training to users or groups from the Training tab",
          "Set a due date for completion",
          "Users receive an email with a link to the training module",
          "Upon completion, the system logs the date and stores the certificate",
          "Overdue training is flagged red in the workforce roster"
        ]
      },
      {
        heading: "Access Reviews",
        body: "Periodic access reviews (quarterly or annually) ensure that users have only the access they need. EnterpriseComply integrates with Okta, Active Directory, and other identity providers to pull current access lists for review.",
        tips: [
          "Assign access reviews to system owners, not just IT administrators",
          "Flag accounts with privileged access for more frequent review (monthly)",
          "Completed access review evidence is automatically linked to relevant controls (e.g., AC-2 Account Management)"
        ]
      }
    ]
  },
  "questionnaires": {
    title: "Questionnaires",
    intro: "The Questionnaire module automates vendor security assessments, internal audits, and customer-facing compliance questionnaires. EnterpriseComply supports SIG-Lite, CAIQ, VSAQ, and custom templates with AI-assisted auto-fill.",
    sections: [
      {
        heading: "Sending a Vendor Assessment",
        body: "Use questionnaires to evaluate the security posture of vendors who process or store your data.",
        steps: [
          "Navigate to Questionnaires in the sidebar",
          "Click New Questionnaire → Select Template (SIG-Lite, CAIQ, or custom)",
          "Enter the vendor name and contact email",
          "Set a due date for completion",
          "Click Send - the vendor receives a secure link to complete the questionnaire"
        ]
      },
      {
        heading: "AI Auto-Fill",
        body: "For inbound questionnaires (customers asking about your security), EnterpriseComply's AI engine can automatically answer questions by referencing your existing controls, policies, and evidence.",
        tips: [
          "Review all AI-suggested answers in the Needs Review tab before finalizing",
          "The AI confidence score (High/Medium/Low) indicates how certain the match is",
          "Override any answer by clicking the edit icon and typing your own response"
        ]
      },
      {
        heading: "Needs Review Queue",
        body: "Answers that the AI flagged as uncertain (confidence below threshold) appear in the Needs Review tab. A compliance team member should review and approve or override each flagged answer before the questionnaire is submitted.",
        steps: [
          "Click the Needs Review tab on the Questionnaires page",
          "Review each flagged question and the AI-suggested answer",
          "Edit the answer if needed",
          "Click Approve to mark the answer as reviewed",
          "Once all items are approved, submit the questionnaire"
        ]
      }
    ]
  },
  "remediation": {
    title: "Remediation Board",
    intro: "The Remediation Board is a kanban-style workspace for tracking and resolving compliance findings. Every failing control automatically generates a remediation ticket that moves through Open → In Progress → Resolved → Verified.",
    sections: [
      {
        heading: "Working with Remediation Tickets",
        body: "Click any ticket on the board to open its detail panel. From there you can view the failing control, add comments, attach evidence, assign an owner, and set a due date (SLA).",
        steps: [
          "Open Remediation from the sidebar",
          "Click a ticket to open its detail panel",
          "Review the failing control and its requirements",
          "Assign an owner from the Owner dropdown",
          "Set a due date for resolution",
          "Add comments documenting your remediation plan",
          "Move the ticket through stages by dragging or using the status dropdown",
          "Attach evidence once the control is remediated",
          "Move to Verified once an auditor or manager confirms the fix"
        ],
        tips: [
          "SLA deadlines are color-coded: green (on track), yellow (approaching), red (overdue)",
          "Critical findings are automatically prioritized at the top of each column",
          "Resolved tickets that are not verified within 14 days send automatic reminders"
        ]
      },
      {
        heading: "Filtering the Board",
        body: "Use the domain filter, owner filter, and framework filter at the top of the board to focus on a specific subset of tickets. Filters are preserved when you navigate away and return.",
      }
    ]
  },
  "federal": {
    title: "Federal Compliance",
    intro: "EnterpriseComply includes specialized features for federal contractors pursuing CMMC certification, FedRAMP authorization, and ITAR/EAR compliance.",
    sections: [
      {
        heading: "CMMC Assessment Preparation",
        body: "CMMC (Cybersecurity Maturity Model Certification) requires demonstrating implementation of practices from NIST SP 800-171. EnterpriseComply maps all 110 NIST 800-171 practices to trackable controls.",
        steps: [
          "Select CMMC Level (1, 2, or 3) under Settings → Frameworks",
          "Complete the self-assessment for all practices in the Controls page",
          "Document your System Security Plan (SSP) using the built-in SSP builder",
          "Identify any gaps and create POA&M entries for practices not yet implemented",
          "Calculate your SPRS score from the Assessment page",
          "Export the SPRS score report for submission to eMASS or PIEE"
        ],
        tips: [
          "CMMC Level 2 requires a C3PAO assessment - EnterpriseComply generates the documentation package C3PAOs expect",
          "Keep your POA&M up to date; gaps without a documented plan can be disqualifying",
          "SPRS scores are calculated automatically as you mark practices passing"
        ]
      },
      {
        heading: "POA&M Management",
        body: "A Plan of Action and Milestones (POA&M) documents known security gaps and your plan to resolve them. Every failing CMMC or NIST 800-171 control automatically generates a POA&M entry.",
        tips: [
          "Each POA&M entry must have a scheduled completion date and responsible party",
          "Export POA&M as a spreadsheet (OSCAL-compatible) for submission to DoD",
          "Milestone dates approaching or overdue appear on the Dashboard"
        ]
      },
      {
        heading: "FedRAMP Authorization",
        body: "FedRAMP requires cloud service providers to obtain authorization to operate (ATO) through a rigorous assessment of NIST 800-53 controls. EnterpriseComply supports all three impact levels: Low, Moderate, and High.",
      },
      {
        heading: "SPRS Score",
        body: "Your DoD Supplier Performance Risk System (SPRS) score (ranging from -203 to +110) is calculated from your NIST 800-171 self-assessment. EnterpriseComply auto-calculates and tracks this score as controls are assessed.",
      }
    ]
  },
    "zero-trust": {
    title: "Zero Trust Assessment",
    intro: "The Zero Trust Assessment module evaluates your organization against CISA ZTMM v2.0 (Zero Trust Maturity Model) across 5 pillars: Identity, Devices, Networks, Applications & Workloads, and Data. Each pillar is scored from Traditional (0%) through Initial, Advanced, to Optimal (100%). Overall maturity is captured as a RAG (Red/Amber/Green) status.",
    sections: [
      {
        heading: "Running Your ZTA Score",
        body: "Click the Run ZTA Score button in the top-right of the Zero Trust Assessment page to trigger an automated scoring pass. The engine reads your current control evidence and generates per-pillar maturity scores, dependency cap violations, and gap findings.",
        steps: [
          "Navigate to Federal > Zero Trust Assessment",
          "Click Run ZTA Score (or Run First Score on a fresh account)",
          "Wait for the Scoring... indicator to resolve",
          "Review the pillar score cards - each shows a maturity stage badge (Traditional/Initial/Advanced/Optimal)",
          "Click any pillar card to see the function-level breakdown in the right panel",
          "Check the Gap Analysis tab for prioritized remediation findings mapped to NIST 800-53 and UCO controls"
        ]
      },
      {
        heading: "Understanding Pillar Scores",
        body: "Each of the 5 ZTMM pillars is scored 0-100%. Scores are capped by dependency rules: for example, Networks cannot advance to Advanced if Identity remains at Traditional. The Dependency Cap Violations panel in the overview tab highlights any active caps and explains the rule.",
        steps: [
          "Traditional (0-25%): Basic controls in place but not systematic",
          "Initial (25-50%): Defined processes and some automation",
          "Advanced (50-75%): Automated enforcement with visibility",
          "Optimal (75-100%): Adaptive, continuously monitored ZT architecture",
          "A red warning badge on a pillar card indicates an active dependency cap"
        ]
      },
      {
        heading: "ZTMM Crosswalk Tab",
        body: "The ZTMM Crosswalk tab maps every Zero Trust function to corresponding NIST SP 800-53 Rev 5 controls, UCO controls, and evidence artifacts. Use this to demonstrate ZT compliance posture during audits.",
        steps: [
          "Click the ZTMM Crosswalk tab on the Zero Trust Assessment page",
          "Review the mapping of each pillar function to NIST 800-53 controls",
          "Use the UCO control column to trace evidence artifacts",
          "Export the crosswalk data for audit documentation"
        ]
      },
      {
        heading: "Score Trend History",
        body: "The Score Trend tab shows your ZTA score history over the last 90 days. Run the assessment regularly (at least monthly) to build a trend graph. Each snapshot records the overall score, maturity level, and a delta versus the previous run.",
        steps: [
          "Click the Score Trend tab",
          "Run multiple ZTA Scores over time to generate trend data",
          "Green delta (+%) indicates improvement; red indicates regression",
          "Export trend data for CISA ZTMM compliance reporting"
        ]
      }
    ]
  },
  "conmon": {
    title: "Continuous Monitoring Program",
    intro: "The ConMon Program page implements NIST SP 800-137A ISCM (Information Security Continuous Monitoring) requirements, FedRAMP ConMon, and OMB Circular A-130. It provides a live dashboard of 10 automated security metrics from integrated tools including Okta, Splunk SIEM, Tenable.io, Wiz, and CrowdStrike Falcon.",
    sections: [
      {
        heading: "ISCM Dashboard",
        body: "The ISCM Dashboard shows the current status of all monitored metrics segmented by Normal, Warning, and Alert states. Metrics that breach their thresholds are highlighted in red (Alert) or amber (Warning). Normal metrics are grouped at the bottom.",
        steps: [
          "Navigate to Federal > ConMon Program",
          "Review the status banner (Metrics Monitored, Normal, Warnings, Active Alerts)",
          "Active Alert metrics are listed first with source tool and last check timestamp",
          "Click Export ConMon Report to download a text report of all metric statuses and drift events"
        ]
      },
      {
        heading: "Monitoring Strategy",
        body: "The Monitoring Strategy tab documents your ISCM monitoring frequency per control family per NIST SP 800-137A. Five categories are defined: Ongoing (real-time), Weekly, Monthly, Quarterly, and Annual - each mapped to specific NIST 800-53 controls, methods, and tools.",
        steps: [
          "Click the Monitoring Strategy tab",
          "Review frequency cadences mapped to control families",
          "Continuous monitoring covers AC-2, AU-6, IR-4, SI-4, and related high-risk controls",
          "Use this table as evidence for FedRAMP ConMon program documentation"
        ]
      },
      {
        heading: "Score Drift Detection",
        body: "The Score Drift Detection tab tracks regression events - significant drops in metric values that indicate a deteriorating security posture. Any regression > 2% triggers notification. Each drift event includes the trigger cause, before/after values, and percentage change.",
        steps: [
          "Click the Score Drift Detection tab",
          "Review recent drift events with dates and trigger causes",
          "Red negative percentages indicate score regression",
          "Drift events that meet POA&M thresholds should be elevated to the Risk Register"
        ]
      },
      {
        heading: "Exporting ConMon Reports",
        body: "The Export ConMon Report button (top-right) and the Generate button on individual report schedules both download a structured text report. The report includes the ISCM executive summary, all metric statuses with thresholds and sources, and all drift events - suitable for FedRAMP monthly ConMon submission.",
        steps: [
          "Click Export ConMon Report from any tab",
          "A .txt file downloads named conmon-report-[date].txt",
          "The ConMon Reports tab shows scheduled report due dates",
          "Click Generate next to any scheduled report to download the same report"
        ]
      }
    ]
  },
  "crosswalk": {
    title: "Control Crosswalk Engine",
    intro: "The Control Crosswalk Engine provides a single-pane multi-framework mapping of your UCO (Universal Control Object) controls to NIST 800-53 Rev 5, CMMC 2.0, NIST 800-171 Rev 3, SOC 2 TSC, and ISO 27001:2022. 14 UCO controls are mapped across 5 frameworks with coverage percentages and integration sources.",
    sections: [
      {
        heading: "Viewing the Crosswalk",
        body: "The crosswalk table lists each UCO control with its status (Passing/Partial/Failing) and the corresponding control identifiers from each active framework. Coverage bars show what percentage of framework requirements are satisfied.",
        steps: [
          "Navigate to Compliance > Controls, then select Control Crosswalk from the breadcrumb or direct navigation",
          "Review the summary stats: total UCO controls, passing/partial/failing counts, and average coverage",
          "Toggle individual framework columns using the Active Frameworks selector",
          "Click any row to expand the full framework mapping and see all connected integrations"
        ]
      },
      {
        heading: "Filtering and Searching",
        body: "Use the search bar to filter by UCO ID or control name. Filter by control family (Access Control, Configuration Management, Vulnerability Management, etc.) and by status (Passing, Partial, Failing).",
        steps: [
          "Type a UCO ID (e.g. UCO-AC-001) or control name in the search bar",
          "Select a family from the dropdown to view controls by domain",
          "Set status filter to Failing to see gaps requiring remediation",
          "Combine filters for targeted analysis"
        ]
      },
      {
        heading: "Exporting the Crosswalk",
        body: "Click Export Crosswalk to download a CSV file of all filtered crosswalk data. The export includes UCO ID, control name, family, status, coverage percentage, all active framework control mappings, and integration sources. Use this for audit evidence packages and gap analysis documentation.",
        steps: [
          "Apply any desired filters to narrow the crosswalk data",
          "Click the Export Crosswalk button (top-right)",
          "A CSV file downloads named control-crosswalk-[date].csv",
          "Import the CSV into Excel or your GRC documentation system"
        ]
      }
    ]
  },
"test-runs": {
    title: "Test Run History",
    intro: "Automated control tests run on a schedule against your connected integrations to provide continuous compliance monitoring. The Test Run History page shows all past runs, their results, and any failures.",
    sections: [
      {
        heading: "How Automated Tests Work",
        body: "When you connect an integration (GitHub, AWS, Okta, etc.), EnterpriseComply creates test definitions that query the integration's API on a schedule. Test results are mapped back to controls and update their pass/fail status automatically.",
        tips: [
          "Tests run nightly by default; enterprise plans support hourly test runs",
          "A single integration may run dozens of tests - each mapped to a specific control",
          "Failed tests create new findings on the Remediation Board automatically"
        ]
      },
      {
        heading: "Running Tests Manually",
        body: "Click Run Tests Now at the top of the Test Run History page to trigger an immediate test run. This is useful after making a configuration change and wanting to verify the result before the next scheduled run.",
        steps: [
          "Navigate to Test Run History in the sidebar",
          "Click Run Tests Now (blue button, top right)",
          "A spinner confirms the run has been triggered",
          "Refresh the page after 30-60 seconds to see the new run results"
        ]
      },
      {
        heading: "Interpreting Results",
        body: "Each test run shows a timestamp, duration, total tests run, and counts of passed/failed/errored tests. Click a run row to see the individual test results with the specific control each test maps to.",
        tips: [
          "Error status (distinct from Fail) means the test could not connect to the integration - check your API credentials",
          "A sudden increase in failures after an integration sync may indicate a configuration change in the external system"
        ]
      }
    ]
  },
  "assets": {
    title: "Asset Inventory",
    intro: "The Asset Inventory catalogs every system component, data store, and service within your compliance boundary. A complete, accurate asset inventory is required by virtually every compliance framework.",
    sections: [
      {
        heading: "Adding Assets",
        body: "Add assets manually or import from AWS, Azure, GCP, or a CSV spreadsheet.",
        steps: [
          "Navigate to Asset Inventory in the sidebar",
          "Click Add Asset or Import",
          "Fill in: asset name, type (server, database, SaaS, endpoint, etc.), owner, environment (production, staging, dev), data classification",
          "Tag assets with the relevant frameworks and data types (CUI, PII, PHI, etc.)",
          "Save - the asset appears in your inventory and system boundary diagram"
        ],
        tips: [
          "Connect AWS Config or Azure Policy to auto-discover and import cloud resources",
          "Tag CUI-bearing assets explicitly - they drive CMMC Level 2/3 scoping",
          "Decommissioned assets should be archived (not deleted) to preserve the audit trail"
        ]
      },
      {
        heading: "System Boundary",
        body: "The system boundary defines which assets are in-scope for each compliance framework. Assets outside the boundary don't affect your compliance score for that framework.",
      },
      {
        heading: "Data Flow Diagrams",
        body: "Use the data flow view to document how CUI, PII, or sensitive data moves between assets. Data flow documentation is required for SSP and FedRAMP packages.",
      }
    ]
  },
  "settings": {
    title: "Settings",
    intro: "Settings is where you configure your organization profile, user management, notifications, integrations, and compliance framework selections.",
    sections: [
      {
        heading: "Organization Profile",
        body: "Update your organization name, CAGE code, NAICS codes, entity type, address, and logo under Settings → Organization. This information appears in exported reports and audit packages.",
      },
      {
        heading: "User Management",
        body: "Manage who has access to your EnterpriseComply organization under Settings → Users.",
        steps: [
          "Click Invite User and enter an email address",
          "Select the role: Admin, Compliance Manager, Auditor, or Read-Only",
          "The user receives an invitation email with a secure sign-in link",
          "To remove a user, click their row and select Remove from Org"
        ],
        tips: [
          "Auditor role is read-only with the ability to add comments - ideal for external auditors",
          "Compliance Manager role can edit controls, policies, and evidence but cannot change org settings",
          "Admin role has full access including billing and user management"
        ]
      },
      {
        heading: "Notifications",
        body: "Configure email and in-app notifications for: evidence approaching expiry, control status changes, remediation SLA deadlines, policy review due dates, and new questionnaire submissions.",
      },
      {
        heading: "Framework Selection",
        body: "Add or remove compliance frameworks under Settings → Frameworks. Only controls for active frameworks appear in the Controls Library and count toward your score.",
        tips: [
          "You can have multiple frameworks active simultaneously",
          "Removing a framework hides its controls but does not delete any data"
        ]
      }
    ]
  },
  "faq": {
    title: "Frequently Asked Questions",
    intro: "Answers to the most common questions from compliance managers, IT teams, and auditors using EnterpriseComply.",
    sections: [
      {
        heading: "General",
        body: "",
        tips: [
          "Q: What frameworks does EnterpriseComply support? A: CMMC Level 1/2/3, NIST SP 800-171, NIST SP 800-53, FedRAMP Low/Moderate/High, SOC 2 Type I/II, ISO 27001:2022, HIPAA, ITAR/EAR, PCI-DSS, and custom frameworks.",
          "Q: How is my compliance score calculated? A: The score is a weighted average of control pass rates. Critical-severity controls carry higher weight. Evidence freshness also factors in - stale evidence reduces the score for affected controls.",
          "Q: Can I use EnterpriseComply for multiple organizations? A: Each organization has its own isolated workspace. Contact us to set up a multi-tenant arrangement for MSPs or parent/subsidiary structures.",
          "Q: Is my data secure? A: Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). EnterpriseComply is hosted on FedRAMP-authorized infrastructure and undergoes annual SOC 2 Type II audits.",
          "Q: Can I export my compliance data? A: Yes. Export controls, evidence, risk registers, and POA&Ms as CSV, PDF, or OSCAL-format JSON at any time from each module's export menu."
        ]
      },
      {
        heading: "Controls & Evidence",
        body: "",
        tips: [
          "Q: What happens when a control's evidence expires? A: The control is flagged as Needs Attention. If not refreshed within the grace period (configurable, default 14 days), the control status reverts to Failing and your score drops.",
          "Q: Can the same evidence satisfy multiple controls? A: Yes. Evidence can be linked to any number of controls across any framework.",
          "Q: How do I handle a control that doesn't apply to my environment? A: Mark it Not Applicable with a written justification. N/A controls are excluded from your score calculation.",
          "Q: What file types are supported for evidence uploads? A: PDF, PNG, JPG, DOCX, XLSX, CSV, TXT, and ZIP archives up to 50MB per file.",
          "Q: How long is evidence retained? A: Evidence is retained for 7 years by default to support long-term audit requirements. Retention period is configurable under Settings → Data Retention."
        ]
      },
      {
        heading: "CMMC & Federal",
        body: "",
        tips: [
          "Q: Does EnterpriseComply help me calculate my SPRS score? A: Yes. Your SPRS score is auto-calculated in real time as you assess NIST 800-171 practices. Find it on the Federal → SPRS page.",
          "Q: Can I use EnterpriseComply for a C3PAO assessment? A: Yes. The platform generates the documentation package (SSP, POA&M, evidence artifacts) in the format C3PAOs expect.",
          "Q: What's the difference between CMMC Level 1 and Level 2? A: Level 1 covers 17 basic cyber hygiene practices protecting FCI. Level 2 covers all 110 NIST 800-171 practices protecting CUI and requires a third-party assessment every 3 years.",
          "Q: Does the platform support ITAR compliance? A: Yes. ITAR/EAR compliance features include access controls for foreign national restrictions, export-controlled data tagging, and audit logging.",
          "Q: Can I share my compliance package with a government customer? A: Yes. Export a read-only compliance report or generate a shareable audit link with configurable expiry from any module."
        ]
      },
      {
        heading: "Integrations & Automation",
        body: "",
        tips: [
          "Q: What integrations are supported? A: 30+ integrations including AWS, Azure, GCP, GitHub, GitLab, Jira, Okta, Azure AD, CrowdStrike, SentinelOne, Qualys, Tenable, Splunk, Datadog, and more.",
          "Q: How do I reconnect an integration that stopped syncing? A: Go to Settings → Integrations, find the disconnected integration (shown with a red status dot), click Reconnect, and re-authorize access.",
          "Q: Can integrations collect evidence in real time? A: Some integrations support webhooks for near-real-time evidence collection. Check the integration's settings page for sync options.",
          "Q: What happens if an automated test fails? A: A finding is created on the Remediation Board, the control is marked Failing, and notification recipients configured under Settings → Notifications are alerted.",
          "Q: Can I write custom test scripts? A: Enterprise plan customers can add custom test definitions using our open API. Contact support for the test definition schema."
        ]
      },
      {
        heading: "Policies & Workforce",
        body: "",
        tips: [
          "Q: How do I get my team to acknowledge a policy? A: Open the policy, click Require Acknowledgment, select the recipients, and set a deadline. Team members receive an email with a one-click acknowledgment link.",
          "Q: What happens if someone doesn't acknowledge a policy by the deadline? A: The system sends automatic reminder emails at 7 days, 3 days, and 1 day before the deadline. Overdue acknowledgments are flagged on the Workforce page.",
          "Q: Can I upload our existing policies instead of using templates? A: Yes. Click Add Policy → Upload Document and attach your existing policy PDF or DOCX. You can then tag it with frameworks and set lifecycle dates.",
          "Q: How often should policies be reviewed? A: Best practice is annually. EnterpriseComply sends you a review reminder before the policy's review date. Critical policies (Incident Response, Access Control) should be reviewed semi-annually.",
          "Q: Can I version-control policies? A: Yes. Every edit creates a new version. Previous versions are accessible from the policy's History tab."
        ]
      }
    ]
  },
  "glossary": {
    title: "Glossary",
    intro: "Key terms used throughout EnterpriseComply and the broader GRC landscape.",
    sections: [
      {
        heading: "A - F",
        body: "",
        tips: [
          "ATO (Authority to Operate): A formal authorization from a government agency to operate an IT system, required for FedRAMP.",
          "C3PAO (Certified Third-Party Assessment Organization): An organization authorized by the CMMC Accreditation Body to perform Level 2 and Level 3 CMMC assessments.",
          "CAGE Code: Commercial and Government Entity code - a 5-character identifier assigned by the DoD to vendors in the defense supply chain.",
          "CUI (Controlled Unclassified Information): Government-created information that requires safeguarding per law, regulation, or policy but is not classified.",
          "CMMC (Cybersecurity Maturity Model Certification): A DoD framework that requires contractors handling FCI or CUI to achieve certified cybersecurity practices.",
          "Evidence: Documented proof that a security control is implemented and operating effectively.",
          "FCI (Federal Contract Information): Information provided by or generated for the government under a federal contract that is not intended for public release.",
          "FedRAMP (Federal Risk and Authorization Management Program): A government-wide program providing a standardized approach to security assessment and authorization for cloud services."
        ]
      },
      {
        heading: "G - N",
        body: "",
        tips: [
          "GRC (Governance, Risk, and Compliance): The integrated approach to managing an organization's governance policies, risk assessments, and compliance requirements.",
          "ITAR (International Traffic in Arms Regulations): U.S. regulations controlling the export of defense-related articles and services.",
          "MFA (Multi-Factor Authentication): A security control requiring two or more verification factors to access a system.",
          "NAICS Code: North American Industry Classification System code - used to classify business activities and determine set-aside eligibility for government contracts.",
          "NIST SP 800-53: NIST Special Publication 800-53 - a catalog of security and privacy controls for federal information systems.",
          "NIST SP 800-171: NIST Special Publication 800-171 - specifies requirements for protecting CUI in non-federal systems; forms the basis of CMMC Level 2."
        ]
      },
      {
        heading: "P - Z",
        body: "",
        tips: [
          "POA&M (Plan of Action and Milestones): A corrective action plan documenting known security gaps, planned remediation steps, and scheduled completion dates.",
          "POAM: See POA&M.",
          "Remediation: The process of fixing a security finding or gap so the associated control passes.",
          "Risk Register: A centralized record of identified risks, their assessed likelihood and impact, treatment plans, and status.",
          "SOC 2 (System and Organization Controls 2): An auditing standard for service organizations covering security, availability, processing integrity, confidentiality, and privacy.",
          "SPRS (Supplier Performance Risk System): A DoD system for tracking contractor performance scores, including NIST 800-171 self-assessment scores.",
          "SSP (System Security Plan): A formal document describing how a system implements its security requirements; required for FedRAMP and CMMC.",
          "Vendor Assessment: A structured questionnaire used to evaluate the security posture of third-party vendors who handle your data.",
          "VSAQ (Vendor Security Assessment Questionnaire): Google's open-source vendor security questionnaire template, commonly used in tech industry supply chain assessments."
        ]
      }
    ]
  }
  "vuln-management": {
    title: "Vulnerability Management",
    intro: "The Vulnerability Management page normalizes findings from Tenable, Qualys, Wiz, CrowdStrike, Snyk, Veracode, Checkmarx, Orca, and SentinelOne into a single register with FedRAMP/CMMC SLA tracking.",
    sections: [
      {
        heading: "Viewing the Vulnerability Register",
        body: "The Vulnerability Register tab lists all CVE findings with severity, affected asset, source scanner, status, SLA countdown, and linked POA&M ID. Filter by severity, status, or source using the dropdowns.",
        steps: ["Navigate to Vulnerability > Vuln Management", "Review Critical and High findings at the top", "Use the Search bar to find specific CVEs or assets", "Filter by severity, status, or source scanner using the dropdown menus"]
      },
      {
        heading: "Syncing Scanners",
        body: "The Sync Scanners button triggers a refresh of all connected scanner feeds. Click to pull the latest findings and update SLA countdowns. The button shows Syncing... during the operation and confirms with a success notification.",
        steps: ["Click Sync Scanners (top-right of page)", "Wait for the Syncing... loading state to complete", "Review the updated finding counts in the dashboard tiles"]
      },
      {
        heading: "Exporting to POA\u0026M",
        body: "Click Export to POA&M to download a CSV of all open findings formatted for FedRAMP and CMMC POA&M submission, including CVE ID, severity, asset, source, SLA status, and linked POA&M references.",
        steps: ["Click Export to POA\u0026M (top-left of page)", "Wait for Exporting... state to complete", "Open the downloaded CSV in Excel or import into eMASS"]
      }
    ]
  },
  "fisma-reporting": {
    title: "FISMA Reporting",
    intro: "The FISMA Reporting module provides Federal Information Security Modernization Act CIO metrics, FITARA scorecard preparation, and quarterly compliance package generation per OMB M-21-02 and CISA guidance.",
    sections: [
      {
        heading: "Generating Your FISMA Report",
        body: "Select the reporting quarter from the dropdown in the top-right, then click Generate Report to download a comprehensive FISMA compliance package as a text file including CIO metrics, domain scores, and remediation summaries.",
        steps: ["Navigate to Federal > FISMA Reporting", "Select the target quarter from the dropdown", "Click Generate Report", "The report downloads as a .txt file", "Submit to agency leadership per your reporting schedule"]
      },
      {
        heading: "Reading the FISMA Scorecard",
        body: "The FISMA Scorecard tab shows CIO Metrics per OMB M-21-02 with scores and grades for Identity, Device Management, Data, Network Security, Vulnerability Management, Security Awareness, Continuous Monitoring, and Incident Response.",
        steps: ["Review the Overall Grade in the banner", "Check Metrics Green/Yellow/Red counts", "Red metrics indicate areas requiring immediate attention", "Use the Export Packages tab for domain-specific compliance exports"]
      }
    ]
  },
  "poam": {
    title: "Plan of Action & Milestones",
    intro: "The POA&M module tracks remediation of security weaknesses per FedRAMP, FISMA, and CMMC requirements. Each item includes the weakness, point of contact, risk classification, and scheduled completion milestones.",
    sections: [
      {
        heading: "Creating and Managing POA\u0026M Items",
        body: "Click + New Item to open the creation form with all FedRAMP-required fields. Use Import from failing controls to automatically populate items from Failing controls, ensuring every unmitigated weakness has a corresponding POA&M entry.",
        steps: ["Navigate to Federal > POA\u0026M", "Click + New Item", "Enter Title, Weakness Name, Owner, Severity, Risk levels, Framework, and Completion Date", "Click Create Item", "OR click Import from failing controls for automatic population"]
      }
    ]
  },
  "sprs": {
    title: "SPRS Score",
    intro: "The SPRS Score Calculator computes your Supplier Performance Risk System score per NIST SP 800-171 / CMMC Level 2 DoD Assessment Methodology v1.2.1. Scores range from -203 to +110.",
    sections: [
      {
        heading: "Reading Your SPRS Score",
        body: "Your SPRS score is displayed at the top with status (Critical / At Risk / On Track). Top Gaps by Point Value shows which failing controls have the highest score impact. The DoD Assessment Methodology table shows all 110 practices with point values.",
        steps: ["Navigate to Federal > SPRS Score", "Review your current score and status", "Check Controls Met, Not Met, and Not Yet Assessed counts", "Focus remediation on top gaps by point value", "Click DoD Methodology PDF for the official scoring guide", "Target +110 for full DoD contract eligibility"]
      }
    ]
  },
  "ssp": {
    title: "SSP Generator",
    intro: "The SSP Generator creates formatted System Security Plans for FedRAMP, CMMC, NIST 800-53, SOC 2, ISO 27001, and HIPAA. The 3-step wizard collects system information, environment details, and exports a ready-to-submit document.",
    sections: [
      {
        heading: "Generating Your SSP",
        body: "Complete the 3-step wizard: Step 1 (System Info) captures name, description, owner, framework, data classification, and authorizing official. Step 2 (Environment) captures boundary and interconnections. Step 3 (Review & Export) provides PDF and DOCX export.",
        steps: ["Navigate to Federal > SSP Generator", "Complete Step 1: enter all required system information fields", "Click Next: Environment", "Complete Step 2: describe environment and system components", "Click Next: Review & Export", "Review the generated SSP", "Click Export as PDF or Export as DOCX"]
      }
    ]
  },
  "stigs": {
    title: "STIG Findings",
    intro: "The STIG Findings module imports and tracks DISA Security Technical Implementation Guide checklists. CAT I/II/III findings are mapped to UCO controls and required for FedRAMP and CMMC assessments.",
    sections: [
      {
        heading: "Importing a STIG Checklist",
        body: "Export your checklist from DISA STIG Viewer as a .ckl file, then import it. Findings are parsed and categorized as CAT I (critical - immediate risk), CAT II (high risk - requires mitigation), or CAT III (medium risk), and mapped to UCO controls.",
        steps: ["Export your checklist from DISA STIG Viewer as a .ckl file", "Navigate to Federal > STIG Findings", "Click + New Checklist", "Upload the .ckl file", "Review findings organized by CAT level", "Link findings to UCO controls for evidence collection"]
      }
    ]
  },
  "system-boundary": {
    title: "System Boundary",
    intro: "The System Boundary Registry implements NIST RMF system categorization and ATO status tracking per FIPS 199. Register each information system with authorization details, FIPS categorization, components, and control inheritance.",
    sections: [
      {
        heading: "Registering and Viewing Systems",
        body: "Click a system card to view its details across four tabs: System Overview (authorization details, ATO status, system components), FIPS 199 Categorization (CIA impact levels), Control Inheritance (common controls), and Interconnections (ISAs/MOUs). Use + Register System to add new systems.",
        steps: ["Navigate to Federal > System Boundary", "Click a system card to view details", "Review System Overview for ATO status and expiration", "Check FIPS 199 Categorization for impact levels", "Review Control Inheritance for inherited controls", "Click + Register System to add a new system"]
      }
    ]
  },
  "nist-800-171": {
    title: "NIST 800-171 Rev 3",
    intro: "The NIST 800-171 Rev 3 module tracks DFARS 252.204-7012 and CMMC 2.0 readiness across all 191 Rev 3 controls, including the 83 new controls added in the May 2024 revision, with a CMMC 2.0 practice crosswalk.",
    sections: [
      {
        heading: "Reviewing Readiness & Exporting Gaps",
        body: "The Rev 3 Overview tab shows overall readiness %, compliant vs. gap families, and a readiness-by-family chart. Use Export Gap Report for a CSV of non-compliant practices. The CMMC 2.0 Crosswalk tab maps Rev 3 gaps to CMMC practices.",
        steps: ["Navigate to Federal > NIST 800-171 Rev 3", "Review overall readiness percentage", "Check Critical Gaps for DFARS Compliance panel", "Click Expand all domains to see individual practice status", "Click Export Gap Report for formatted gap analysis CSV", "Use CMMC 2.0 Crosswalk tab to map to CMMC practices"]
      }
    ]
  },
  "monitoring": {
    title: "Continuous Monitoring",
    intro: "The Monitoring module provides real-time security posture tracking, automated drift detection, and an immutable audit trail. Tests run on schedule against connected integrations and alert when configured thresholds are breached.",
    sections: [
      {
        heading: "Live Overview, Jobs & Alert Settings",
        body: "The Live Overview tab shows the 30-day pass rate trend and alert threshold status cards. Monitoring Jobs shows all scheduled test runs. Alert Settings lets you configure thresholds and notification preferences for each alert type.",
        steps: ["Navigate to Evidence > Monitoring", "Review the 30-day trend chart and alert threshold cards", "Click Alerts tab to see active alert history", "Click Monitoring Jobs to view scheduled tests", "Click Alert Settings to configure thresholds and notification delivery"]
      }
    ]
  },
  "vendors": {
    title: "Vendors",
    intro: "The Vendors module manages third-party vendor risk per SOC 2 CC9.2 and GDPR/DPA requirements. Track vendor risk tiers, DPA status, schedule security assessments, and maintain your sub-processor register.",
    sections: [
      {
        heading: "Managing Your Vendor Directory",
        body: "Click + Add Vendor to register vendors with risk tier (Critical/High/Medium/Low) and DPA status. Use the Assessments & Queue tab to schedule security assessments for high-risk vendors, and the Sub-Processors tab for GDPR sub-processor disclosure.",
        steps: ["Navigate to Workforce > Vendors", "Click + Add Vendor", "Enter vendor name, contact, and risk tier", "Set DPA status (signed/pending/not required)", "Schedule an assessment for High/Critical vendors", "Track sub-processors in the Sub-Processors tab"]
      }
    ]
  },
  "trust-center": {
    title: "Trust Center",
    intro: "The Trust Center is your public-facing security and compliance page. Share the URL with prospects, customers, and auditors to demonstrate live compliance posture instead of filling out manual security questionnaires.",
    sections: [
      {
        heading: "Setting Up and Sharing Your Trust Center",
        body: "Click Setup guide for configuration. The Trust Center auto-populates from live compliance data. Add certifications, list sub-processors, and configure security practices. Click Share Trust Center to get your public URL to embed in your security page or vendor portal.",
        steps: ["Navigate to Audit & Sales > Trust Center", "Click Setup guide to configure your public page", "Activate frameworks to show compliance scores", "Add certifications in the Certifications tab", "List sub-processors in the Sub-processors tab", "Add security practices in the Security Practices tab", "Click Share Trust Center to get and share your public URL"]
      }
    ]
  },
  "audit-log": {
    title: "Audit Log",
    intro: "The Audit Log provides an immutable record of all changes and actions across your organization. Entries are retained for 12 months and serve as required audit evidence for SOC 2 Type II, FedRAMP, and CMMC assessments.",
    sections: [
      {
        heading: "Reading and Filtering the Audit Log",
        body: "The Audit Log table shows Timestamp, Actor (user or system), Action (e.g. policy.published, control.updated, evidence.deleted), and Resource. Filter entries using the Filter logs search bar. The Deletions counter flags potentially sensitive deletion activity.",
        steps: ["Navigate to Account > Audit Log", "Review recent entries in reverse chronological order", "Use the Filter logs... search bar to find specific actions or actors", "Monitor the Deletions counter for unexpected activity", "Export log entries as needed for your auditor or ISSM"]
      }
    ]
  },

};

// --- Component ------------------------------------------------------
export default function Documentation() {
  const [activeSection, setActiveSection] = useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Flatten all content for search
  const allText = Object.entries(CONTENT).map(([id, page]) => {
    const fullText = [page.title, page.intro, ...page.sections.flatMap(s => [s.heading, s.body, ...(s.tips || []), ...(s.steps || [])])].join(" ").toLowerCase();
    return { id, title: page.title, text: fullText };
  });

  const matchingSections = searchQuery.length > 1
    ? allText.filter(item => item.text.includes(searchQuery.toLowerCase())).map(item => item.id)
    : null;

  const activePage = CONTENT[activeSection];
  const navSections = NAV_SECTIONS.filter(s => matchingSections ? matchingSections.includes(s.id) : true);

  return (
    <div className="flex h-full bg-gray-50 min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Icon d={ICONS.book} className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-gray-900 text-sm">Documentation</span>
          </div>
          <input
            type="text"
            placeholder="Search docs…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <nav className="py-2">
          {navSections.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500">No results for "{searchQuery}"</p>
          )}
          {navSections.map(section => (
            <button
              key={section.id}
              onClick={() => { setActiveSection(section.id); setSearchQuery(""); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-indigo-50 text-indigo-700 font-medium border-r-2 border-indigo-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon d={ICONS[section.icon as keyof typeof ICONS] || ICONS.doc} className="h-4 w-4 flex-shrink-0" />
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {activePage ? (
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
              <span>Documentation</span>
              <span>/</span>
              <span className="text-gray-900 font-medium">{activePage.title}</span>
            </nav>

            {/* Page header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{activePage.title}</h1>
              {activePage.intro && (
                <p className="text-gray-600 leading-relaxed">{activePage.intro}</p>
              )}
            </div>

            {/* Sections */}
            <div className="space-y-8">
              {activePage.sections.map((section, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.heading}</h2>
                  {section.body && (
                    <p className="text-gray-600 leading-relaxed mb-4">{section.body}</p>
                  )}

                  {/* Steps */}
                  {section.steps && section.steps.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Steps</p>
                      <ol className="space-y-2">
                        {section.steps.map((step, si) => (
                          <li key={si} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                              {si + 1}
                            </span>
                            <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Tips / Q&A / Glossary entries */}
                  {section.tips && section.tips.length > 0 && (
                    <div className="space-y-2">
                      {activeSection === "faq"
                        ? section.tips.map((tip, ti) => {
                            const qIdx = tip.indexOf("A:");
                            const question = qIdx > -1 ? tip.slice(0, qIdx).replace(/^Q:s*/, "").trim() : tip;
                            const answer = qIdx > -1 ? tip.slice(qIdx + 2).trim() : "";
                            return (
                              <div key={ti} className="border border-indigo-100 rounded-lg p-4 bg-indigo-50">
                                <p className="font-semibold text-indigo-900 text-sm mb-1">{question}</p>
                                {answer && <p className="text-indigo-800 text-sm leading-relaxed">{answer}</p>}
                              </div>
                            );
                          })
                        : activeSection === "glossary"
                        ? section.tips.map((tip, ti) => {
                            const colonIdx = tip.indexOf(":");
                            const term = colonIdx > -1 ? tip.slice(0, colonIdx).trim() : tip;
                            const definition = colonIdx > -1 ? tip.slice(colonIdx + 1).trim() : "";
                            return (
                              <div key={ti} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
                                <span className="font-semibold text-gray-900 text-sm w-48 flex-shrink-0">{term}</span>
                                <span className="text-sm text-gray-600 leading-relaxed">{definition}</span>
                              </div>
                            );
                          })
                        : (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                              <Icon d={ICONS.info} className="h-3.5 w-3.5" /> Tips
                            </p>
                            <ul className="space-y-1.5">
                              {section.tips.map((tip, ti) => (
                                <li key={ti} className="flex items-start gap-2 text-sm text-amber-900">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer nav */}
            <div className="mt-10 flex items-center justify-between pt-6 border-t border-gray-200">
              {(() => {
                const ids = NAV_SECTIONS.map(s => s.id);
                const currentIdx = ids.indexOf(activeSection);
                const prev = currentIdx > 0 ? NAV_SECTIONS[currentIdx - 1] : null;
                const next = currentIdx < ids.length - 1 ? NAV_SECTIONS[currentIdx + 1] : null;
                return (
                  <>
                    {prev ? (
                      <button onClick={() => setActiveSection(prev.id)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        ← {prev.label}
                      </button>
                    ) : <div />}
                    {next ? (
                      <button onClick={() => setActiveSection(next.id)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        {next.label} →
                      </button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a section from the sidebar
          </div>
        )}
      </main>
    </div>
  );
}

function RiskGuide() {
  return (
    <div>
      <Para>The Risk Register is a structured inventory of risks that could impact your organization's security, operations, or compliance posture. Maintaining a formal Risk Register is required for SOC 2 CC3.1, ISO 27001 Clause 6.1, and FedRAMP RA-3.</Para>
      <SectionHeading>Risk Fields</SectionHeading>
      <BulletList items={[
        "Title - Short description of the risk (e.g., 'Unauthorized access to production database')",
        "Category - Technical, Operational, Compliance, Financial, or Reputational",
        "Likelihood - How probable is the risk materializing (Low / Medium / High / Critical)",
        "Impact - The severity of consequences if the risk occurs (Low / Medium / High / Critical)",
        "Risk Score - Calculated automatically as Likelihood × Impact (scale 1-16)",
        "Owner - The person responsible for monitoring and mitigating this risk",
        "Mitigation - Controls or actions in place to reduce the risk",
        "Status - Open, Mitigated, Accepted, or Transferred",
        "Review Date - When this risk entry should be re-evaluated",
      ]} />
      <SectionHeading>Risk Treatment Options</SectionHeading>
      <BulletList items={[
        "Mitigate - Implement controls to reduce the likelihood or impact (most common)",
        "Accept - Formally acknowledge the risk and document the business justification for accepting it",
        "Transfer - Shift the risk to a third party (e.g., cyber insurance, vendor contract indemnification)",
        "Avoid - Eliminate the activity that creates the risk altogether",
      ]} />
      <CalloutBox type="warning">Accepted risks must be documented with a rationale and approved by management. Auditors will ask for evidence of formal risk acceptance for any high or critical risks left open.</CalloutBox>
      <SectionHeading>How to Add a Risk</SectionHeading>
      <Para>Click '+ Add Risk' on the Risk Register page, fill in the required fields, and click Save. The risk score is calculated automatically. Use the AI Gap Analysis to identify risks that stem from failing controls - these are pre-populated as suggestions in the Risk Register.</Para>
    </div>
  );
}

function WorkforceGuide() {
  return (
    <div>
      <Para>The Workforce module tracks the people, vendors, and access reviews that make up your human security program. Auditors care deeply about who has access to what, and whether access is reviewed regularly.</Para>
      <SectionHeading>People Roster</SectionHeading>
      <Para>The People page is your employee and contractor directory within EnterpriseComply. Each person record includes name, email, department, role, and employment type. Syncing with an HRIS integration (ADP, Gusto) automatically keeps the roster current. People in the roster can receive policy acknowledgment requests and be assigned as control owners.</Para>
      <SectionHeading>Access Reviews</SectionHeading>
      <Para>SOC 2 CC6.3, ISO 27001 A.9.2, and CMMC AC.L2-3.1.3 all require periodic reviews of who has access to systems and whether that access is still appropriate. The Access Reviews page lets you create review campaigns, assign reviewers, and track completion. EnterpriseComply can import access lists from connected identity providers (Okta, Auth0, Azure AD) to populate the review automatically.</Para>
      <SectionHeading>Vendor Management</SectionHeading>
      <Para>Vendors who process your data are a supply-chain risk that auditors scrutinize. The Vendors page tracks your third-party relationships with their risk tier, contact information, and assessment status. From the Questionnaires page, you can send a SIG-Lite or CAIQ security questionnaire directly to a vendor and track their response.</Para>
      <CalloutBox type="tip">Link vendor records to your Risk Register entries. When a vendor risk is flagged, the connection between the vendor, the risk, and any associated controls creates a complete audit trail.</CalloutBox>
    </div>
  );
}

function QuestionnairesGuide() {
  return (
    <div>
      <Para>The Security Questionnaires module helps you respond to inbound customer security questionnaires (SQAs) and send outbound vendor assessments - faster and more accurately than manual copy-paste from spreadsheets.</Para>
      <SectionHeading>Incoming Questionnaires (SQA)</SectionHeading>
      <Para>When an enterprise customer or prospect sends you a security questionnaire (SIG-Lite, CAIQ, VSAQ, or custom), you can create a questionnaire record and let EnterpriseComply auto-fill answers by matching questions against your compliance controls and evidence. The platform maps question keywords to UCO control IDs and populates answers from your actual control status.</Para>
      <SectionHeading>Supported Templates</SectionHeading>
      <BulletList items={[
        "SIG-Lite (20 questions) - Standardized Information Gathering; used by enterprise procurement teams during vendor onboarding",
        "CAIQ (15 questions) - Cloud Controls Matrix assessment; common in financial services, healthcare, and government procurement",
        "VSAQ (10 questions) - Google's Vendor Security Assessment Questionnaire; used for early-stage vendor triage",
      ]} />
      <SectionHeading>Needs Review Queue</SectionHeading>
      <Para>Auto-generated answers with confidence below 70% are flagged in the 'Needs Review' tab. These items require a human to verify the answer before the questionnaire is sent. Click through each item, edit the answer if needed, and click 'Approve' to clear it from the queue. This two-step workflow ensures no incorrect answers reach your customers.</Para>
      <SectionHeading>Vendor Assessments</SectionHeading>
      <Para>From the 'Vendor Assessments' tab, select any vendor from your Vendors roster and send them a SIG-Lite or CAIQ assessment. The vendor receives a link and completes the questionnaire. Responses are tracked per-question and stored as evidence of your vendor due diligence program - satisfying SOC 2 CC9.2, ISO 27001 A.15, and GDPR Article 28.</Para>
      <CalloutBox type="info">Always review auto-filled answers before sending to a customer. EnterpriseComply uses keyword matching - a human review ensures accuracy and tone consistency with your organization's style.</CalloutBox>
    </div>
  );
}

function RemediationGuide() {
  return (
    <div>
      <Para>The Remediation Board is a Kanban-style workspace for tracking control remediation work. It organizes all controls into three columns - To Do, Failing, and Passing - so your team can visualize progress at a glance.</Para>
      <SectionHeading>Board Columns</SectionHeading>
      <BulletList items={[
        "To Do - Controls that have not yet been tested; no evidence collected",
        "Failing - Controls with evidence that did not meet the required threshold; require action",
        "Passing - Controls with passing evidence; no immediate action needed",
      ]} />
      <SectionHeading>Assigning Owners and Due Dates</SectionHeading>
      <Para>Click any control card to open its detail slide-over. In the slide-over, click 'Assign owner' to set a responsible team member and a due date. The owner's name and due date appear on the card so accountability is visible to the whole team. Owner assignments sync with the Controls page - changes made in either place are reflected everywhere.</Para>
      <SectionHeading>Moving Controls</SectionHeading>
      <Para>Use the green checkmark button on a Failing card to mark it Passing after remediation is complete. Use the red X to move a Passing control back to Failing if a regression is detected. You can also use the Mark Passing / Mark Failing buttons in the detail slide-over, optionally adding remediation notes that appear in the audit log.</Para>
      <SectionHeading>Domain Filter</SectionHeading>
      <Para>Use the domain filter chips above the board to focus on one security domain at a time (Access Control, Data Protection, Vulnerability Management, etc.). This is useful when running a targeted remediation sprint focused on a specific framework gap.</Para>
      <CalloutBox type="tip">Use the AI Gap Analysis page to generate a prioritized remediation roadmap. The analysis ranks failing controls by severity and framework impact, so you know which controls to tackle first for maximum audit readiness improvement.</CalloutBox>
    </div>
  );
}

function FederalGuide() {
  return (
    <div>
      <Para>The Federal section contains tools specifically required for US federal compliance frameworks: CMMC, FedRAMP, FISMA, and DFARS/ITAR. These are required for organizations pursuing federal contracts or handling Controlled Unclassified Information (CUI).</Para>
      <SectionHeading>POA&M - Plan of Action & Milestones</SectionHeading>
      <Para>A POA&M (pronounced "poe-am") is a formal document required by FISMA, FedRAMP, and CMMC that tracks all known security weaknesses and the plan to remediate them. EnterpriseComply generates a POA&M automatically from your failing controls, populating the required fields: weakness description, resources required, milestones, scheduled completion date, and status.</Para>
      <SectionHeading>SPRS Score</SectionHeading>
      <Para>The Supplier Performance Risk System (SPRS) score is a number from -203 to 110 that represents your NIST SP 800-171 compliance level. It is required for all DoD contractors. EnterpriseComply calculates your SPRS score automatically from your UCO control results. The score updates in real time as controls move between passing and failing states.</Para>
      <SectionHeading>System Security Plan (SSP)</SectionHeading>
      <Para>The SSP is the master compliance document for FedRAMP and FISMA authorizations. EnterpriseComply generates a pre-populated SSP from your organization profile, connected integrations, control status, and Asset Inventory. The generated SSP follows the FedRAMP SSP template structure and can be exported as a PDF or Word document for submission to your Authorizing Official.</Para>
      <SectionHeading>STIG Findings</SectionHeading>
      <Para>Security Technical Implementation Guides (STIGs) are DoD hardening benchmarks. The STIG Findings page allows you to import STIG scan results, categorize findings by Category I/II/III severity, and track remediation status. Open STIG findings feed directly into your POA&M.</Para>
      <SectionHeading>Asset Inventory</SectionHeading>
      <Para>CMMC requires a documented inventory of all assets that process CUI. The Asset Inventory page (also accessible from Compliance → Asset Inventory) lets you catalog hardware, software, cloud services, and data stores. Each asset entry includes asset type, owner, classification level, and whether it is in scope for your compliance boundary.</Para>
      <CalloutBox type="warning">CMMC Level 2 certification requires a third-party assessment organization (C3PAO) audit. EnterpriseComply helps you prepare evidence packages but does not replace the formal assessment process. Contact your C3PAO at least 6 months before your contract award date.</CalloutBox>
    </div>
  );
}

function TestRunsGuide() {
  return (
    <div>
      <Para>Test Run History shows a chronological log of every automated security check that EnterpriseComply has run against your connected integrations over the past 30 days.</Para>
      <SectionHeading>How Tests Work</SectionHeading>
      <Para>When an integration is connected, EnterpriseComply schedules automated tests based on the integration's sync frequency (daily, weekly, or real-time). Each test checks a specific security condition - for example, the GitHub integration checks whether branch protection rules are enabled, whether code reviews are required, and whether Dependabot vulnerability alerts are active. Results are stored as individual test runs with pass/fail status, duration, and error details.</Para>
      <SectionHeading>Running Tests Manually</SectionHeading>
      <Para>Click the blue 'Run Tests Now' button to immediately trigger a test sweep across all connected integrations. This is useful when you have made a configuration change and want to verify the control now passes before your next scheduled sync. Results appear in the list within 60 seconds.</Para>
      <SectionHeading>Pass Rate</SectionHeading>
      <Para>The pass rate bar shows the percentage of test runs that passed over the 30-day window. A target of 80%+ is generally considered healthy. A declining pass rate trend indicates controls are drifting out of compliance - investigate with your security team.</Para>
      <SectionHeading>Filtering</SectionHeading>
      <Para>Use the search bar to find tests by control name or UCO control ID. Use the Passed / Failed filter buttons to narrow to specific result types. This is useful when investigating a specific integration health issue.</Para>
    </div>
  );
}

function AssetsGuide() {
  return (
    <div>
      <Para>The Asset Inventory is a catalog of all systems, hardware, software, cloud services, and data stores within your compliance boundary. Maintaining an accurate asset inventory is required by SOC 2 CC6.1, ISO 27001 A.8, and CMMC AC.L1-3.1.1.</Para>
      <SectionHeading>Asset Types</SectionHeading>
      <BulletList items={[
        "Hardware - Physical servers, laptops, workstations, network equipment",
        "Software - Applications, operating systems, databases, SaaS tools",
        "Cloud Service - AWS accounts, Azure subscriptions, GCP projects, SaaS platforms",
        "Data Store - Databases, file shares, S3 buckets, backup systems",
        "Network - Firewalls, VPNs, routers, load balancers",
        "Other - IoT devices, mobile devices, printers",
      ]} />
      <SectionHeading>Classification Levels</SectionHeading>
      <BulletList items={[
        "Public - No sensitivity; freely shareable",
        "Internal - For employees only; not for external distribution",
        "Confidential - Restricted to authorized personnel; requires need-to-know",
        "Restricted - Highest sensitivity; CUI, PHI, PCI data; strongest access controls required",
      ]} />
      <SectionHeading>How to Add an Asset</SectionHeading>
      <Para>Click '+ Add Asset' and fill in the asset name, type, classification, owner, environment (production, staging, development), and whether it is in scope for your compliance boundary. The 'In Scope' flag determines which assets appear in your SSP system boundary definition.</Para>
      <CalloutBox type="info">Import bulk asset data using the CSV import feature (Settings → Data Import). This is useful for organizations migrating from a spreadsheet-based asset tracking system.</CalloutBox>
    </div>
  );
}

function SettingsGuide() {
  return (
    <div>
      <Para>Settings is where administrators manage the organization profile, team members, billing, integrations, and data export options.</Para>
      <SectionHeading>Organization Profile</SectionHeading>
      <BulletList items={[
        "Organization name, logo, and industry classification",
        "Primary compliance contact and CISO name",
        "Employee count and primary cloud environment",
        "CAGE Code and DUNS/SAM.gov UEI (for federal contractors)",
      ]} />
      <SectionHeading>Team Management</SectionHeading>
      <Para>Invite team members via email from Settings → Team. Assign each member a role (Admin, Owner, Member). Members receive an email invitation to join your organization workspace. You can deactivate access for departed employees without deleting their audit history.</Para>
      <SectionHeading>Audit Log</SectionHeading>
      <Para>The Audit Log records every action taken within EnterpriseComply - control updates, policy changes, evidence uploads, user logins, and settings changes. The log is tamper-evident and can be exported as CSV for auditor review. This satisfies the audit trail requirements of SOC 2 CC7.2 and ISO 27001 A.12.4.</Para>
      <SectionHeading>Data Export</SectionHeading>
      <Para>From Settings → Data Export, you can download a full export of your compliance data in JSON format, including all controls, evidence items, risks, policies, and people records. This is useful for backup, migration, or providing data to an auditor who prefers working with raw data.</Para>
    </div>
  );
}
