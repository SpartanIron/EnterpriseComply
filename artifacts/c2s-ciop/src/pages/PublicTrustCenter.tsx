import { useState } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const LAST_UPDATED = "June 2025";

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECURITY_CONTROLS = [
  {
    title: "Encryption at rest",
    desc: "All customer data is encrypted at rest using AES-256. Database volumes, backups, and file storage all use server-side encryption managed by Railway and Cloudflare.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    badge: "AES-256",
  },
  {
    title: "Encryption in transit",
    desc: "All traffic is encrypted via TLS 1.2 or higher. HTTPS is enforced site-wide. HTTP requests are automatically redirected. Cloudflare handles certificate management and HSTS.",
    icon: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z",
    badge: "TLS 1.2+",
  },
  {
    title: "Multi-tenant data isolation",
    desc: "Every customer's data is logically isolated by a unique organization ID. Every database query, API call, and session is scoped to a single tenant. Cross-tenant access is architecturally prevented at the data layer.",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    badge: "Row-level",
  },
  {
    title: "Passwordless authentication",
    desc: "Sign-in uses magic links - time-limited, single-use tokens sent to verified email addresses. No passwords means no password theft, reuse, or brute-force attacks. TOTP authenticator apps add a second factor.",
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    badge: "Magic link + TOTP",
  },
  {
    title: "Role-based access control",
    desc: "Granular roles (Viewer, Analyst, Compliance Manager, Auditor, Org Admin) restrict access to only the features each user needs. Org admins control all role assignments within their tenant.",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    badge: "6 role levels",
  },
  {
    title: "Immutable audit logging",
    desc: "Every user action - sign-in, data access, configuration change, export, permission change - is written to an append-only audit log with timestamp, user ID, and IP. Logs cannot be edited or deleted by any user.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    badge: "Append-only",
  },
  {
    title: "Automated vulnerability scanning",
    desc: "Dependencies are scanned continuously for known CVEs. Critical vulnerabilities are patched within 24 hours of public disclosure. The codebase is hosted on GitHub with branch protection and required code review on all changes.",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    badge: "CI/CD enforced",
  },
  {
    title: "Backup and recovery",
    desc: "Railway provides continuous PostgreSQL replication with point-in-time recovery. RTO target is under 4 hours. RPO target is under 1 hour. Backups are tested quarterly.",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4-8 4s8 1.79 8 4",
    badge: "RTO < 4h, RPO < 1h",
  },
];

const INFRASTRUCTURE = [
  {
    name: "GitHub",
    role: "Source code & CI/CD",
    desc: "All application code is version-controlled on GitHub. Branch protection rules, required reviews, and automated security scanning are enforced on every merge. No code reaches production without a peer review.",
    details: ["Branch protection on main", "Required pull request reviews", "Automated dependency scanning", "Secret scanning enabled"],
    link: "https://github.com/security",
    color: "slate",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    name: "Railway",
    role: "Application hosting & database",
    desc: "The application is deployed on Railway, a SOC 2 Type II certified infrastructure provider. Railway runs on Google Cloud Platform in US regions. The PostgreSQL database and application containers both run on Railway with automatic failover.",
    details: ["SOC 2 Type II certified", "Automatic HTTPS & TLS termination", "PostgreSQL with PITR backups", "US-region data residency"],
    link: "https://railway.app/legal/privacy",
    color: "violet",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 12.214c0 6.144 4.579 11.243 10.514 11.786L0 4.571v7.643zM23.729 9c-.471-5.567-4.714-10.029-10.1-10.829L23.729 9zM13.629 0C7.414 0 2.443 5.129 2.443 11.357v.143l10.529-11.5H13.629zM24 12.214v-.214-.643L13.057 23.871C19.043 23.386 24 18.271 24 12.214z" />
      </svg>
    ),
  },
  {
    name: "Cloudflare",
    role: "CDN, WAF & DDoS protection",
    desc: "All traffic passes through Cloudflare before reaching the application. Cloudflare provides a Web Application Firewall (WAF), DDoS mitigation, TLS termination, and global CDN caching for static assets. Bot protection and rate limiting are active on all endpoints.",
    details: ["Web Application Firewall (WAF)", "DDoS mitigation (unlimited)", "Bot protection & rate limiting", "Global CDN - 300+ PoPs"],
    link: "https://www.cloudflare.com/gdpr/introduction/",
    color: "orange",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.427 15.854l.314-.87c.38-1.05.28-2.01-.277-2.71-.514-.65-1.35-1.003-2.37-.997l-8.763.12c-.08 0-.15-.037-.19-.1-.04-.063-.044-.14-.01-.21l.195-.535c.08-.223.278-.37.51-.38l8.844-.12c1.045-.01 2.12-.33 2.96-.89.84-.56 1.453-1.365 1.74-2.276.03-.09.05-.17.065-.25C17.81 5.08 15.727 4 13.38 4 11.1 4 9.134 5.04 8.057 6.65c-.534-.376-1.18-.585-1.864-.585-1.775 0-3.213 1.44-3.213 3.217 0 .17.013.34.04.508C1.71 9.97 0 11.724 0 13.887 0 16.152 1.837 18 4.1 18h11.77c1.16 0 2.21-.54 2.84-1.44.62-.9.75-2.04.37-3.06l-.653-1.646z" />
      </svg>
    ),
  },
];

const SUBPROCESSORS = [
  {
    name: "Cloudflare, Inc.",
    purpose: "CDN, DDoS protection, WAF, DNS, bot protection",
    category: "Security / CDN",
    region: "Global (300+ PoPs)",
    data: "Network traffic metadata, IP addresses",
    dpa: true,
    link: "https://www.cloudflare.com/gdpr/introduction/",
  },
  {
    name: "Railway Corp.",
    purpose: "Application hosting, PostgreSQL database, container orchestration",
    category: "Infrastructure",
    region: "US (Google Cloud, us-west-1)",
    data: "All customer data, database content, application logs",
    dpa: true,
    link: "https://railway.app/legal/privacy",
  },
  {
    name: "GitHub, Inc. (Microsoft)",
    purpose: "Source code repository, CI/CD pipeline, security scanning",
    category: "Development",
    region: "US",
    data: "Source code, build artifacts (no customer data)",
    dpa: true,
    link: "https://github.com/site/privacy",
  },
  {
    name: "SendGrid (Twilio, Inc.)",
    purpose: "Transactional email delivery (magic links, notifications, welcome emails)",
    category: "Communications",
    region: "US",
    data: "Email addresses, notification content",
    dpa: true,
    link: "https://www.twilio.com/legal/privacy",
  },
  {
    name: "Google LLC",
    purpose: "Underlying cloud infrastructure for Railway services",
    category: "Infrastructure",
    region: "US (us-west-1)",
    data: "Encrypted infrastructure layer - no direct data access",
    dpa: true,
    link: "https://cloud.google.com/security/gdpr",
  },
];

const FRAMEWORKS = [
  { name: "SOC 2 Type II", desc: "Security, Availability, Confidentiality" },
  { name: "ISO 27001", desc: "Information security management" },
  { name: "HIPAA", desc: "Healthcare data protection" },
  { name: "PCI DSS", desc: "Payment card industry standard" },
  { name: "FedRAMP", desc: "Federal cloud authorization" },
  { name: "CMMC Level 2", desc: "Defense contractor cybersecurity" },
  { name: "NIST CSF", desc: "Cybersecurity framework" },
  { name: "NIST 800-171", desc: "CUI protection" },
  { name: "GDPR", desc: "EU data protection" },
  { name: "CCPA", desc: "California consumer privacy" },
  { name: "NIST 800-53", desc: "Federal information systems" },
  { name: "CIS Controls", desc: "Critical security controls" },
];

const CERTIFICATIONS = [
  {
    name: "SOC 2 Type II",
    status: "In Progress",
    statusColor: "blue",
    desc: "Audit period: Jan - Jun 2025. Report expected Q3 2025.",
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  },
  {
    name: "ISO 27001",
    status: "Planned Q4 2025",
    statusColor: "slate",
    desc: "Gap assessment complete. Formal audit scheduled.",
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  },
];

const STAT_BADGES = [
  { value: "AES-256", label: "Encryption standard" },
  { value: "TLS 1.2+", label: "All traffic in transit" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "PITR", label: "Database backup type" },
];

type Tab = "overview" | "security" | "infrastructure" | "subprocessors" | "certifications" | "portability";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PublicTrustCenter() {
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "security", label: "Security" },
    { id: "infrastructure", label: "Infrastructure" },
    { id: "subprocessors", label: "Sub-processors" },
    { id: "certifications", label: "Certifications" },
    { id: "portability", label: "Data portability" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <a href={BASE_PATH + "/"} className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" alt="" />
            <div>
              <span className="font-bold text-slate-900 text-sm leading-tight block">EnterpriseComply</span>
              <span className="text-xs text-slate-400 leading-tight block">Trust Center</span>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="mailto:security@colorcodesolutions.com"
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Security contact
            </a>
            <a
              href="mailto:privacy@colorcodesolutions.com"
              className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Request DPA
            </a>
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">All systems operational</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-3">
                Security and compliance at EnterpriseComply
              </h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-xl">
                This page provides a transparent overview of how we protect your compliance data - our infrastructure, security controls, sub-processors, and data handling practices. Updated {LAST_UPDATED}.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-5">
                {[
                  "Multi-tenant isolation",
                  "Passwordless auth + TOTP 2FA",
                  "Cloudflare WAF",
                  "Railway SOC 2 infra",
                  "AES-256 encryption",
                  "Audit logging",
                ].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              {STAT_BADGES.map((b) => (
                <div key={b.label} className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-center">
                  <p className="text-xl font-bold text-slate-900 mb-0.5">{b.value}</p>
                  <p className="text-xs text-slate-500">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[57px] z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Principle callout */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg mb-1.5">Our security principle</p>
                  <p className="text-blue-100 text-sm leading-relaxed max-w-3xl">
                    Security is bundled into every plan - not an add-on, not a premium tier. Every customer gets encryption, audit logging, multi-factor authentication, multi-tenant isolation, and Cloudflare WAF protection regardless of plan size. We believe compliance software must itself be trustworthy.
                  </p>
                </div>
              </div>
            </div>

            {/* 3-column quick look */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: "Your data is isolated",
                  body: "Every customer's data lives in its own logical silo. Your controls, evidence, risks, policies, and audit logs are never accessible by other organizations - not even by ColorCode Solutions staff without explicit written request.",
                  icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                  color: "blue",
                },
                {
                  title: "Your data is encrypted",
                  body: "Data is encrypted at rest with AES-256 and in transit with TLS 1.2+. Cloudflare handles TLS termination and enforces HTTPS across all endpoints. Database volumes are encrypted by Railway on Google Cloud infrastructure.",
                  icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                  color: "green",
                },
                {
                  title: "Your data is yours",
                  body: "You can export your entire compliance program at any time - controls, evidence, POA&Ms, risks, policies - in open formats (CSV, JSON, PDF). No support ticket. No waiting period. No lock-in.",
                  icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
                  color: "violet",
                },
              ].map((card) => (
                <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${
                    card.color === "blue" ? "bg-blue-50" : card.color === "green" ? "bg-green-50" : "bg-violet-50"
                  }`}>
                    <svg className={`h-5 w-5 ${
                      card.color === "blue" ? "text-blue-600" : card.color === "green" ? "text-green-600" : "text-violet-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-900 text-sm mb-2">{card.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>

            {/* Frameworks we support */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="font-bold text-slate-800 text-sm">Compliance frameworks supported</p>
                <p className="text-xs text-slate-500 mt-0.5">EnterpriseComply helps your organization achieve and maintain compliance with all of these frameworks.</p>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {FRAMEWORKS.map((fw) => (
                  <div key={fw.name} className="border border-slate-100 rounded-xl p-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-800 mb-0.5">{fw.name}</p>
                    <p className="text-xs text-slate-400">{fw.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 bg-red-50 rounded-xl flex items-center justify-center">
                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">Report a vulnerability</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  We take security disclosures seriously. If you discover a vulnerability, please email us directly. We commit to a 24-hour initial response and 72-hour patch timeline for critical issues. We do not pursue legal action against good-faith security research.
                </p>
                <a href="mailto:security@colorcodesolutions.com" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  security@colorcodesolutions.com
                </a>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded">24h response</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">Safe harbor</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 bg-purple-50 rounded-xl flex items-center justify-center">
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">Data Processing Agreement</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  A DPA is available for all customers who require one for GDPR, CCPA, or other regulatory compliance. Request it below and we will return a signed copy within 2 business days.
                </p>
                <a href="mailto:privacy@colorcodesolutions.com" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  privacy@colorcodesolutions.com
                </a>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded">GDPR ready</span>
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded">2-day turnaround</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Last updated {LAST_UPDATED}. For questions email <a href="mailto:security@colorcodesolutions.com" className="underline">security@colorcodesolutions.com</a>
            </p>
          </div>
        )}

        {/* ── SECURITY ─────────────────────────────────────────────────── */}
        {tab === "security" && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="font-semibold text-green-800 text-sm">Security is included on every plan</p>
                <p className="text-green-700 text-xs mt-0.5 leading-relaxed">Every control below applies to all customers regardless of subscription tier. We do not gate encryption, audit logging, or MFA behind higher-priced plans.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SECURITY_CONTROLS.map((ctrl) => (
                <div key={ctrl.title} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                  <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ctrl.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-900 text-sm">{ctrl.title}</p>
                      <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded">{ctrl.badge}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{ctrl.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Responsible disclosure */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 bg-red-50 rounded-xl flex items-center justify-center">
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-900 text-sm">Responsible disclosure policy</p>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                If you discover a security vulnerability in EnterpriseComply, please report it to <a href="mailto:security@colorcodesolutions.com" className="text-blue-600 hover:underline font-medium">security@colorcodesolutions.com</a>. Do not open a public GitHub issue or post publicly until we have had a chance to respond.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: "Initial response", value: "Within 24 hours" },
                  { title: "Patch timeline (critical)", value: "Within 72 hours" },
                  { title: "Legal stance", value: "No action for good-faith research" },
                ].map((item) => (
                  <div key={item.title} className="bg-slate-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">{item.title}</p>
                    <p className="text-sm font-semibold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INFRASTRUCTURE ───────────────────────────────────────────── */}
        {tab === "infrastructure" && (
          <div className="space-y-6">
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
              EnterpriseComply is built on three core infrastructure providers - GitHub for source control, Railway for hosting and data, and Cloudflare for network security. All three are industry-standard choices with their own security certifications.
            </p>

            {INFRASTRUCTURE.map((infra) => (
              <div key={infra.name} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      infra.color === "slate" ? "bg-slate-900 text-white" :
                      infra.color === "violet" ? "bg-violet-600 text-white" :
                      "bg-orange-500 text-white"
                    }`}>
                      {infra.icon}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{infra.name}</p>
                      <p className="text-sm text-slate-500">{infra.role}</p>
                    </div>
                  </div>
                  <a href={infra.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0">
                    Privacy policy
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">{infra.desc}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {infra.details.map((d) => (
                      <div key={d} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                        <svg className="h-3.5 w-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Data residency */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-900 text-sm">Data residency</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1">Primary region</p>
                  <p className="font-semibold text-slate-800">United States</p>
                  <p className="text-xs text-slate-500 mt-0.5">Railway on Google Cloud us-west-1</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1">CDN edge nodes</p>
                  <p className="font-semibold text-slate-800">Global (Cloudflare)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Static assets only, no PII cached</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1">Data transfer</p>
                  <p className="font-semibold text-slate-800">No cross-border transfers</p>
                  <p className="text-xs text-slate-500 mt-0.5">Customer data stays in US region</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-PROCESSORS ───────────────────────────────────────────── */}
        {tab === "subprocessors" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                  Sub-processors are third-party companies that process customer data on our behalf. All sub-processors listed below have executed Data Processing Agreements (DPAs) with ColorCode Solutions. Customer data is never sold or shared for advertising.
                </p>
              </div>
              <a
                href="mailto:privacy@colorcodesolutions.com"
                className="flex-shrink-0 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Request DPA
              </a>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <div className="col-span-3">Provider</div>
                <div className="col-span-3">Purpose</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Region</div>
                <div className="col-span-2 text-right">DPA</div>
              </div>
              <div className="divide-y divide-slate-100">
                {SUBPROCESSORS.map((sp) => (
                  <div key={sp.name} className="px-5 py-4 grid grid-cols-12 gap-4 hover:bg-slate-50 transition-colors">
                    <div className="col-span-3">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800">{sp.name}</p>
                        <a href={sp.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">{sp.data}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-slate-600 leading-relaxed">{sp.purpose}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">{sp.category}</span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">{sp.region}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      {sp.dpa ? (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">DPA signed</span>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">No DPA</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-700 mb-1">Changes to this list</p>
              <p>We will notify customers via email at least 14 days before adding a new sub-processor that handles customer data. Customers who object to a new sub-processor may terminate their subscription and receive a pro-rated refund for unused time. To be notified of sub-processor changes, email <a href="mailto:privacy@colorcodesolutions.com" className="text-blue-600 hover:underline">privacy@colorcodesolutions.com</a>.</p>
            </div>
          </div>
        )}

        {/* ── CERTIFICATIONS ───────────────────────────────────────────── */}
        {tab === "certifications" && (
          <div className="space-y-6">
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
              EnterpriseComply is actively pursuing formal certifications. In the meantime, we operate on the infrastructure of certified providers and follow the controls required by these frameworks.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CERTIFICATIONS.map((cert) => (
                <div key={cert.name} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    cert.statusColor === "blue" ? "bg-blue-50" : "bg-slate-50"
                  }`}>
                    <svg className={`h-6 w-6 ${cert.statusColor === "blue" ? "text-blue-600" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cert.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm mb-1">{cert.name}</p>
                    <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold mb-2 ${
                      cert.statusColor === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}>{cert.status}</span>
                    <p className="text-xs text-slate-500 leading-relaxed">{cert.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Inherited certifications from infra */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="font-bold text-slate-800 text-sm">Inherited from infrastructure providers</p>
                <p className="text-xs text-slate-500 mt-0.5">Our infrastructure providers are independently certified. EnterpriseComply inherits these controls by building on their platforms.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { provider: "Railway (Google Cloud Platform)", certs: ["SOC 2 Type II", "ISO 27001", "PCI DSS Level 1"], link: "https://railway.app/security" },
                  { provider: "Cloudflare", certs: ["SOC 2 Type II", "ISO 27001", "PCI DSS Level 1", "FedRAMP Authorized"], link: "https://www.cloudflare.com/trust-hub/" },
                  { provider: "GitHub (Microsoft)", certs: ["SOC 2 Type II", "ISO 27001", "FedRAMP Authorized"], link: "https://github.com/security" },
                ].map((row) => (
                  <div key={row.provider} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{row.provider}</p>
                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {row.certs.map((c) => (
                        <span key={c} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
              <p className="font-semibold mb-1">Need a report sooner?</p>
              <p className="text-xs leading-relaxed text-blue-700">
                If your security questionnaire requires a formal certification report before ours is complete, we can provide: our infrastructure providers' SOC 2 reports, our security controls documentation, and a signed attestation letter from ColorCode Solutions management. Email <a href="mailto:security@colorcodesolutions.com" className="underline font-medium">security@colorcodesolutions.com</a>.
              </p>
            </div>
          </div>
        )}

        {/* ── PORTABILITY ──────────────────────────────────────────────── */}
        {tab === "portability" && (
          <div className="space-y-6">
            <div className="bg-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg mb-1.5">Your compliance program is yours. Not ours.</p>
                  <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
                    We have seen what happens when a GRC vendor gets acquired or shuts down - customers rebuild their entire evidence library from scratch. EnterpriseComply is built differently: you own your data, you can export everything at any time in open formats, and you can take it with you - no questions asked.
                  </p>
                </div>
              </div>
            </div>

            {/* Export table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <p className="font-bold text-slate-800 text-sm">What you can export, always - on demand, no ticket required</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { item: "All UCO control implementations and status history", format: "CSV + JSON" },
                  { item: "Complete evidence vault with artifact URLs and metadata", format: "CSV + JSON" },
                  { item: "POA&M register with all FedRAMP-required fields", format: "CSV (eMASS-compatible)" },
                  { item: "Risk register with heat map ratings and control links", format: "CSV + JSON" },
                  { item: "Published policies as signed PDFs", format: "PDF" },
                  { item: "Vendor register with risk ratings and questionnaire responses", format: "CSV + JSON" },
                  { item: "System Security Plan (SSP) as formatted PDF", format: "PDF (print-ready)" },
                  { item: "Full audit log of all platform activity", format: "CSV + JSON" },
                ].map((row) => (
                  <div key={row.item} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-slate-700">{row.item}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex-shrink-0">{row.format}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Commitments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="font-bold text-green-800 text-sm mb-3">Our portability commitments</p>
                <ul className="space-y-2">
                  {[
                    "Exports available on-demand, 24/7, from Settings",
                    "No support ticket, no waiting period, no approval",
                    "Evidence artifact URLs are your URLs - stored as provided",
                    "90-day advance notice of any service termination",
                    "Immediate full export upon account cancellation request",
                    "Open formats only - CSV, JSON, PDF - no proprietary lock-in",
                  ].map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs text-green-700">
                      <svg className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="font-bold text-slate-800 text-sm mb-2">Your GDPR / CCPA rights</p>
                <ul className="space-y-2 mb-4">
                  {[
                    { right: "Right to access", desc: "Request a copy of all personal data we hold about you" },
                    { right: "Right to erasure", desc: "Request deletion of your account and personal data" },
                    { right: "Right to portability", desc: "Receive your data in a machine-readable format" },
                    { right: "Right to rectification", desc: "Correct inaccurate personal data we hold" },
                  ].map((r) => (
                    <li key={r.right} className="flex items-start gap-2 text-xs text-slate-600">
                      <svg className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                      </svg>
                      <span><strong className="text-slate-800">{r.right}:</strong> {r.desc}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400">Submit requests to <a href="mailto:privacy@colorcodesolutions.com" className="text-blue-600 hover:underline">privacy@colorcodesolutions.com</a>. We respond within 30 days.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-6 w-6" alt="" />
            <span className="text-sm font-semibold text-slate-700">EnterpriseComply by ColorCode Solutions</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <a href="mailto:security@colorcodesolutions.com" className="hover:text-slate-600">Security contact</a>
            <a href="mailto:privacy@colorcodesolutions.com" className="hover:text-slate-600">Privacy / DPA</a>
            <a href={BASE_PATH + "/"} className="hover:text-slate-600">Back to app</a>
            <span>Updated {LAST_UPDATED}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
