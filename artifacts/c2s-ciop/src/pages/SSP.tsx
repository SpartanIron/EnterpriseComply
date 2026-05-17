import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const FRAMEWORKS = ["fedramp", "cmmc-l2", "nist-800-53", "soc2", "iso27001", "hipaa"];
const FRAMEWORK_LABELS: Record<string, string> = {
  fedramp: "FedRAMP Moderate",
  "cmmc-l2": "CMMC Level 2",
  "nist-800-53": "NIST SP 800-53 Rev 5",
  soc2: "SOC 2 Type II",
  iso27001: "ISO 27001:2022",
  hipaa: "HIPAA Security Rule",
};

const FEDERAL_FRAMEWORKS = new Set(["fedramp", "nist-800-53", "cmmc-l2"]);

const LAWS_BY_FRAMEWORK: Record<string, string[]> = {
  fedramp: [
    "Federal Information Security Modernization Act (FISMA) 2014",
    "OMB Circular A-130 (Managing Information as a Strategic Resource)",
    "E-Government Act of 2002",
    "Privacy Act of 1974",
    "Federal Records Act",
    "Executive Order 14028 (Improving the Nation's Cybersecurity)",
    "Computer Fraud and Abuse Act (CFAA)",
  ],
  "nist-800-53": [
    "Federal Information Security Modernization Act (FISMA) 2014",
    "OMB Circular A-130 (Managing Information as a Strategic Resource)",
    "Federal Records Act",
    "Privacy Act of 1974",
    "Computer Fraud and Abuse Act (CFAA)",
  ],
  "cmmc-l2": [
    "DFARS 252.204-7012 (Safeguarding Covered Defense Information)",
    "32 CFR Part 170 (CMMC Program Rule)",
    "Federal Information Security Modernization Act (FISMA) 2014",
    "National Defense Authorization Act (NDAA)",
  ],
  soc2: [],
  iso27001: [],
  hipaa: [
    "HIPAA Security Rule (45 CFR Part 164, Subpart C)",
    "HIPAA Privacy Rule (45 CFR Part 164, Subparts A and E)",
    "HITECH Act (Health Information Technology for Economic and Clinical Health)",
    "Breach Notification Rule (45 CFR Part 164, Subpart D)",
  ],
};

const IMPACT_LEVELS = ["Low", "Moderate", "High"];

function overallImpact(c: string, i: string, a: string): string {
  const rank: Record<string, number> = { Low: 1, Moderate: 2, High: 3 };
  const max = Math.max(rank[c] ?? 2, rank[i] ?? 2, rank[a] ?? 1);
  return Object.keys(rank).find((k) => rank[k] === max) ?? "Moderate";
}

function he(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadgeHtml(status: string): string {
  if (status === "Implemented")
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#dcfce7;color:#15803d;font-size:7.5pt;font-weight:600;">Implemented</span>`;
  if (status === "Planned")
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#fef9c3;color:#a16207;font-size:7.5pt;font-weight:600;">Planned</span>`;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#fee2e2;color:#dc2626;font-size:7.5pt;font-weight:600;">Not Implemented</span>`;
}

function originationBadgeHtml(origination: string): string {
  if (origination?.startsWith("Inherited"))
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#ede9fe;color:#6d28d9;font-size:7.5pt;font-weight:600;">Inherited</span>`;
  if (origination === "Hybrid")
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#e0f2fe;color:#0369a1;font-size:7.5pt;font-weight:600;">Hybrid</span>`;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#f1f5f9;color:#475569;font-size:7.5pt;font-weight:600;">System Specific</span>`;
}

function impactBadgeHtml(level: string): string {
  if (level === "High")
    return `<span style="padding:3px 10px;border-radius:4px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:8.5pt;">${level}</span>`;
  if (level === "Moderate")
    return `<span style="padding:3px 10px;border-radius:4px;background:#fef9c3;color:#92400e;font-weight:700;font-size:8.5pt;">${level}</span>`;
  return `<span style="padding:3px 10px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:700;font-size:8.5pt;">${level}</span>`;
}

function generateSspHtml(ssp: any): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const cs = ssp.complianceSummary ?? { totalControls: 0, implemented: 0, planned: 0, notImplemented: 0 };
  const implementedPct = cs.totalControls > 0 ? Math.round((cs.implemented / cs.totalControls) * 100) : 0;
  const fw = ssp.framework?.toLowerCase() ?? "";
  const isFederal = ["fedramp", "nist-800-53", "cmmc-l2"].includes(fw);

  const domainMap: Record<string, any[]> = {};
  for (const c of ssp.controlSections ?? []) {
    if (!domainMap[c.domain]) domainMap[c.domain] = [];
    domainMap[c.domain].push(c);
  }

  const fips199Section = isFederal && ssp.system?.fips199Confidentiality ? `
    <div style="page-break-inside:avoid;">
      <h1 style="font-size:14pt;font-weight:700;color:#0f172a;padding-top:24px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;margin-bottom:14px;">1.4 FIPS 199 Security Categorization</h1>
      <p style="color:#475569;font-size:9pt;margin-bottom:14px;">
        Security categorization is performed in accordance with FIPS Publication 199, <em>Standards for Security Categorization of Federal Information and Information Systems</em>,
        and NIST SP 800-60 Volume I and II.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;color:#64748b;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.05em;">Security Objective</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;color:#64748b;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.05em;">Impact Level</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:600;">Confidentiality</td><td style="padding:9px 12px;border:1px solid #e2e8f0;">${impactBadgeHtml(ssp.system.fips199Confidentiality)}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:600;">Integrity</td><td style="padding:9px 12px;border:1px solid #e2e8f0;">${impactBadgeHtml(ssp.system.fips199Integrity)}</td></tr>
          <tr><td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:600;">Availability</td><td style="padding:9px 12px;border:1px solid #e2e8f0;">${impactBadgeHtml(ssp.system.fips199Availability)}</td></tr>
          <tr style="background:#eff6ff;"><td style="padding:9px 12px;border:1px solid #bfdbfe;font-weight:700;color:#1d4ed8;">Overall System Impact Level</td><td style="padding:9px 12px;border:1px solid #bfdbfe;">${impactBadgeHtml(ssp.system.overallImpactLevel ?? "Moderate")}</td></tr>
        </tbody>
      </table>
    </div>` : "";

  const lawsSection = (ssp.system?.applicableLaws ?? []).length > 0 ? `
    <div style="page-break-inside:avoid;">
      <h1 style="font-size:14pt;font-weight:700;color:#0f172a;padding-top:24px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;margin-bottom:14px;">1.5 Applicable Laws, Regulations, and Standards</h1>
      <p style="color:#475569;font-size:9pt;margin-bottom:12px;">
        The following laws, regulations, and standards apply to this system and govern the security controls implemented in this SSP.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:7px 12px;border:1px solid #e2e8f0;text-align:left;color:#64748b;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.05em;">#</th>
            <th style="padding:7px 12px;border:1px solid #e2e8f0;text-align:left;color:#64748b;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.05em;">Law / Regulation / Standard</th>
          </tr>
        </thead>
        <tbody>
          ${(ssp.system.applicableLaws as string[]).map((law: string, i: number) => `
          <tr style="${i % 2 === 1 ? "background:#f8fafc;" : ""}">
            <td style="padding:7px 12px;border:1px solid #e2e8f0;color:#64748b;">${i + 1}</td>
            <td style="padding:7px 12px;border:1px solid #e2e8f0;">${he(law)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const userTypesSection = ssp.system?.userTypesDescription ? `
    <div style="page-break-inside:avoid;margin-top:24px;">
      <h1 style="font-size:12pt;font-weight:700;color:#0f172a;padding-bottom:6px;border-bottom:2px solid #e2e8f0;margin-bottom:12px;">2.1 User Types and Access</h1>
      <p style="color:#374151;line-height:1.6;white-space:pre-wrap;">${he(ssp.system.userTypesDescription)}</p>
    </div>` : "";

  const portsSection = ssp.system?.portsProtocolsServices ? `
    <div style="page-break-inside:avoid;margin-top:24px;">
      <h1 style="font-size:12pt;font-weight:700;color:#0f172a;padding-bottom:6px;border-bottom:2px solid #e2e8f0;margin-bottom:12px;">2.2 Ports, Protocols, and Services</h1>
      <p style="color:#475569;font-size:9pt;margin-bottom:10px;">The following table identifies the ports, protocols, and services used by this system for inbound and outbound communications.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;font-size:9pt;color:#374151;line-height:1.7;white-space:pre-wrap;font-family:monospace;">${he(ssp.system.portsProtocolsServices)}</div>
    </div>` : "";

  const cryptoSection = (isFederal && ssp.system?.cryptographicModules) ? `
    <div style="page-break-inside:avoid;margin-top:24px;">
      <h1 style="font-size:12pt;font-weight:700;color:#0f172a;padding-bottom:6px;border-bottom:2px solid #e2e8f0;margin-bottom:12px;">2.3 Cryptographic Modules</h1>
      <p style="color:#475569;font-size:9pt;margin-bottom:10px;">
        The following FIPS 140-2/140-3 validated cryptographic modules are used by this system to protect data at rest and in transit.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;font-size:9pt;color:#374151;line-height:1.7;white-space:pre-wrap;">${he(ssp.system.cryptographicModules)}</div>
    </div>` : "";

  const interconnectsSection = ssp.system?.externalConnections ? `
    <div style="page-break-inside:avoid;margin-top:24px;">
      <h1 style="font-size:12pt;font-weight:700;color:#0f172a;padding-bottom:6px;border-bottom:2px solid #e2e8f0;margin-bottom:12px;">2.4 External System Interconnections</h1>
      <p style="color:#475569;font-size:9pt;margin-bottom:10px;">
        The following external systems are interconnected with or exchange data with this system. Each interconnection is governed by an Interconnection Security Agreement (ISA) or Memorandum of Understanding (MOU).
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;font-size:9pt;color:#374151;line-height:1.7;white-space:pre-wrap;">${he(ssp.system.externalConnections)}</div>
    </div>` : "";

  const hasEnvironmentSection = userTypesSection || portsSection || cryptoSection || interconnectsSection;

  const controlsHtml = Object.entries(domainMap)
    .map(([domain, controls], idx) => `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:11pt;font-weight:600;color:#1d4ed8;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #bfdbfe;">
        3.${idx + 1} &nbsp;${he(domain)}
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:7px 10px;text-align:left;border:1px solid #e2e8f0;width:80px;color:#64748b;font-size:7pt;text-transform:uppercase;letter-spacing:0.05em;">ID</th>
            <th style="padding:7px 10px;text-align:left;border:1px solid #e2e8f0;width:150px;color:#64748b;font-size:7pt;text-transform:uppercase;letter-spacing:0.05em;">Control</th>
            <th style="padding:7px 10px;text-align:left;border:1px solid #e2e8f0;width:100px;color:#64748b;font-size:7pt;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
            <th style="padding:7px 10px;text-align:left;border:1px solid #e2e8f0;width:100px;color:#64748b;font-size:7pt;text-transform:uppercase;letter-spacing:0.05em;">Origination</th>
            <th style="padding:7px 10px;text-align:left;border:1px solid #e2e8f0;color:#64748b;font-size:7pt;text-transform:uppercase;letter-spacing:0.05em;">Implementation Statement</th>
          </tr>
        </thead>
        <tbody>
          ${controls.map((c: any, ri: number) => `
          <tr style="${ri % 2 === 1 ? "background:#f8fafc;" : "background:#ffffff;"}">
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-family:monospace;font-size:7.5pt;color:#64748b;white-space:nowrap;vertical-align:top;">${he(c.controlId)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:500;color:#1e293b;vertical-align:top;">${he(c.title)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;vertical-align:top;">${statusBadgeHtml(c.implementationStatus)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;vertical-align:top;">${originationBadgeHtml(c.origination)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#374151;line-height:1.55;vertical-align:top;">${he(c.implementationStatement)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");

  const aoRow = ssp.system?.authorizingOfficialName
    ? `<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#374151;">Authorizing Official</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system.authorizingOfficialName)}${ssp.system.authorizingOfficialTitle ? `, ${he(ssp.system.authorizingOfficialTitle)}` : ""}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SSP - ${he(ssp.system?.name)} - ${he(FRAMEWORK_LABELS[fw] ?? ssp.framework?.toUpperCase())}</title>
  <style>
    @page { margin: 0.8in; size: letter portrait; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1e293b; background: #ffffff; line-height: 1.5; }
    @media print { .no-print { display: none !important; } }
    h1 { font-size: 14pt; font-weight: 700; color: #0f172a; padding-top: 24px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 14px; }
    p { color: #374151; margin-bottom: 10px; }
  </style>
</head>
<body>

<!-- PRINT TOOLBAR -->
<div class="no-print" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;">
  <div>
    <strong style="font-size:11pt;color:#0f172a;">System Security Plan - Preview</strong>
    <span style="margin-left:14px;color:#64748b;font-size:9pt;">Use File &gt; Print (Ctrl/Cmd+P) and select "Save as PDF" to export</span>
  </div>
  <button onclick="window.print()" style="padding:9px 22px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:10pt;font-weight:600;cursor:pointer;font-family:inherit;">
    Print / Save as PDF
  </button>
</div>

<!-- COVER PAGE -->
<div style="text-align:center;padding:2in 0 1.6in;border-bottom:3px solid #1d4ed8;margin-bottom:40px;">
  <div style="font-size:9pt;font-weight:700;color:#3b82f6;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:36px;">
    ${he(ssp.system?.organization)} &nbsp;|&nbsp; EnterpriseComply GRC Platform
  </div>
  <div style="font-size:24pt;font-weight:700;color:#0f172a;margin-bottom:10px;">System Security Plan</div>
  <div style="font-size:13pt;color:#475569;margin-bottom:36px;">
    ${he(FRAMEWORK_LABELS[fw] ?? ssp.framework?.toUpperCase())} &nbsp;|&nbsp; ${he(ssp.system?.name)}
  </div>
  <div style="display:inline-block;padding:6px 18px;border:2px solid #dc2626;color:#dc2626;font-weight:700;font-size:9pt;letter-spacing:0.12em;text-transform:uppercase;border-radius:4px;margin-bottom:40px;">
    ${he(ssp.system?.dataClassification)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:500px;margin:0 auto;text-align:left;">
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Document Version</span>
      <span style="font-size:10pt;font-weight:500;">v${he(ssp.version ?? "1.0")}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Date Generated</span>
      <span style="font-size:10pt;font-weight:500;">${dateStr}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">System Owner</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system?.owner)}</span>
    </div>
    ${ssp.system?.authorizingOfficialName ? `
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Authorizing Official</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system.authorizingOfficialName)}</span>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Operational Status</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system?.operationalStatus)}</span>
    </div>`}
    ${isFederal && ssp.system?.overallImpactLevel ? `
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">FIPS 199 Impact Level</span>
      <span style="font-size:10pt;font-weight:700;color:#dc2626;">${he(ssp.system.overallImpactLevel)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Organization</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system?.organization)}</span>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Organization</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system?.organization)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:7.5pt;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">System Type</span>
      <span style="font-size:10pt;font-weight:500;">${he(ssp.system?.systemType)}</span>
    </div>`}
  </div>
</div>

<!-- SECTION 1: SYSTEM INFORMATION -->
<h1>1. System Information</h1>
<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:20px;">
  <tbody>
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;width:32%;background:#f8fafc;color:#374151;">System Name</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system?.name)}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Organization</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system?.organization)}</td></tr>
    <tr style="background:#fafafa;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">System Owner</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system?.owner)} &lt;${he(ssp.system?.ownerEmail)}&gt;</td></tr>
    ${aoRow}
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Data Classification</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#dc2626;">${he(ssp.system?.dataClassification)}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Operational Status</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system?.operationalStatus)}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">System Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system?.systemType)}</td></tr>
    ${ssp.system?.cloudProvider && ssp.system.cloudProvider !== "N/A - On-Premise" ? `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Cloud Provider</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${he(ssp.system.cloudProvider)}</td></tr>` : ""}
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Compliance Framework</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1d4ed8;">${he(FRAMEWORK_LABELS[fw] ?? ssp.framework?.toUpperCase())}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;color:#374151;">Document Generated</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${dateStr}</td></tr>
  </tbody>
</table>

<h1 style="margin-top:8px;">1.1 System Description</h1>
<p>${he(ssp.system?.description ?? "Not specified.")}</p>

<h1 style="margin-top:8px;">1.2 Authorization Boundary</h1>
<p>${he(ssp.system?.authorizationBoundary)}</p>

<h1 style="margin-top:8px;">1.3 Network Architecture</h1>
<p>${he(ssp.system?.networkDescription)}</p>

${fips199Section}
${lawsSection}

<!-- SECTION 2: SYSTEM ENVIRONMENT -->
${hasEnvironmentSection ? `
<div style="page-break-before:always;"></div>
<h1>2. System Environment and User Access</h1>
<p style="color:#475569;font-size:9pt;margin-bottom:20px;">
  This section describes the system environment, user population, network connectivity, cryptographic protections, and external system interconnections.
</p>
${userTypesSection}
${portsSection}
${cryptoSection}
${interconnectsSection}
` : ""}

<!-- SECTION 3: COMPLIANCE SUMMARY -->
<div style="page-break-before:always;"></div>
<h1>${hasEnvironmentSection ? "3" : "2"}. Compliance Summary</h1>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0 24px;">
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
    <div style="font-size:22pt;font-weight:700;color:#1d4ed8;">${cs.totalControls}</div>
    <div style="font-size:7.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">Total Controls</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
    <div style="font-size:22pt;font-weight:700;color:#15803d;">${cs.implemented}</div>
    <div style="font-size:7.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">Implemented</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
    <div style="font-size:22pt;font-weight:700;color:#d97706;">${cs.planned}</div>
    <div style="font-size:7.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">Planned</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
    <div style="font-size:22pt;font-weight:700;color:#dc2626;">${cs.notImplemented}</div>
    <div style="font-size:7.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">Not Implemented</div>
  </div>
</div>

<p style="color:#475569;font-size:9pt;">
  Implementation rate: <strong style="color:#15803d;">${implementedPct}%</strong> of controls are fully implemented
  (${cs.implemented} of ${cs.totalControls}).
  ${cs.planned > 0 ? `${cs.planned} control${cs.planned !== 1 ? "s" : ""} are planned for implementation.` : ""}
  ${cs.notImplemented > 0 ? `${cs.notImplemented} control${cs.notImplemented !== 1 ? "s" : ""} have not yet been implemented.` : ""}
</p>

<!-- SECTION 4: CONTROL IMPLEMENTATIONS -->
<div style="page-break-before:always;"></div>
<h1>${hasEnvironmentSection ? "4" : "3"}. Control Implementations</h1>
<p style="color:#475569;font-size:9pt;margin-bottom:20px;">
  The following sections document the implementation status and implementation statements for all
  ${cs.totalControls} security controls required under ${he(FRAMEWORK_LABELS[fw] ?? ssp.framework?.toUpperCase())}.
  Controls are organized by security domain. The "Origination" column indicates whether each control is
  System Specific, Inherited from a service provider, or a Hybrid responsibility.
</p>

${controlsHtml}

<!-- FOOTER -->
<div style="margin-top:48px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8;">
  <span>${he(ssp.system?.name)} - ${he(FRAMEWORK_LABELS[fw] ?? ssp.framework?.toUpperCase())} System Security Plan</span>
  <span>Generated ${dateStr} | ${he(ssp.system?.organization)} | CONFIDENTIAL</span>
</div>

</body>
</html>`;
}

type FormState = {
  systemName: string; systemDescription: string; systemOwner: string; systemOwnerEmail: string;
  frameworkKey: string; dataClassification: string;
  authorizingOfficialName: string; authorizingOfficialTitle: string;
  operationalStatus: string; systemType: string; cloudProvider: string;
  authorizationBoundary: string; networkDescription: string;
  fips199Confidentiality: string; fips199Integrity: string; fips199Availability: string;
  applicableLaws: string[];
  userTypesDescription: string; portsProtocolsServices: string;
  cryptographicModules: string; externalConnections: string;
};

export default function SSP() {
  const { orgId } = useOrg();
  const [step, setStep] = useState(1);
  const [generated, setGenerated] = useState<any>(null);
  const [form, setForm] = useState<FormState>({
    systemName: "", systemDescription: "", systemOwner: "", systemOwnerEmail: "",
    frameworkKey: "fedramp",
    dataClassification: "Controlled Unclassified Information (CUI)",
    authorizingOfficialName: "", authorizingOfficialTitle: "",
    operationalStatus: "Operational", systemType: "Cloud-Based",
    cloudProvider: "Amazon Web Services (AWS)",
    authorizationBoundary: "", networkDescription: "",
    fips199Confidentiality: "Moderate", fips199Integrity: "Moderate", fips199Availability: "Low",
    applicableLaws: LAWS_BY_FRAMEWORK["fedramp"] ?? [],
    userTypesDescription: "", portsProtocolsServices: "",
    cryptographicModules: "", externalConnections: "",
  });

  const isFederal = FEDERAL_FRAMEWORKS.has(form.frameworkKey);

  const generateMutation = useMutation({
    mutationFn: (body: FormState) =>
      apiFetch(`/orgs/${orgId}/ssp/generate`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => { setGenerated(d.ssp); setStep(3); },
  });

  const handleExportPdf = () => {
    if (!generated) return;
    const html = generateSspHtml(generated);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const f = (field: keyof FormState, val: string) => setForm({ ...form, [field]: val });

  const toggleLaw = (law: string) => {
    const current = form.applicableLaws;
    setForm({
      ...form,
      applicableLaws: current.includes(law) ? current.filter((l) => l !== law) : [...current, law],
    });
  };

  const handleFrameworkChange = (fw: string) => {
    setForm({
      ...form,
      frameworkKey: fw,
      applicableLaws: LAWS_BY_FRAMEWORK[fw] ?? [],
      dataClassification: fw === "fedramp" || fw === "cmmc-l2"
        ? "Controlled Unclassified Information (CUI)"
        : fw === "hipaa" ? "PHI" : form.dataClassification,
    });
  };

  const cs = generated?.complianceSummary;

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";
  const sectionHeadCls = "text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 mt-5 pb-2 border-b border-slate-100";

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">SSP Generator</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate a formatted System Security Plan - FedRAMP, CMMC, NIST 800-53, SOC 2, ISO 27001, HIPAA
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-3 mb-8">
        {["System Info", "Environment", "Review & Export"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-sm font-medium ${step === i + 1 ? "text-blue-600" : "text-slate-400"}`}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label className={labelCls}>System Name *</label>
              <input value={form.systemName} onChange={(e) => f("systemName", e.target.value)}
                className={inputCls} placeholder="e.g. Acme SaaS Platform" />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>System Description *</label>
              <textarea value={form.systemDescription} onChange={(e) => f("systemDescription", e.target.value)}
                rows={3} className={inputCls} placeholder="Brief description of the system's purpose and capabilities..." />
            </div>

            <div>
              <label className={labelCls}>System Owner *</label>
              <input value={form.systemOwner} onChange={(e) => f("systemOwner", e.target.value)}
                className={inputCls} placeholder="Full name" />
            </div>

            <div>
              <label className={labelCls}>Owner Email *</label>
              <input type="email" value={form.systemOwnerEmail} onChange={(e) => f("systemOwnerEmail", e.target.value)}
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Framework</label>
              <select value={form.frameworkKey} onChange={(e) => handleFrameworkChange(e.target.value)} className={selectCls}>
                {FRAMEWORKS.map((fw) => <option key={fw} value={fw}>{FRAMEWORK_LABELS[fw] ?? fw}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Data Classification</label>
              <select value={form.dataClassification} onChange={(e) => f("dataClassification", e.target.value)} className={selectCls}>
                {["Controlled Unclassified Information (CUI)", "Federal Contract Information (FCI)", "Public", "Sensitive PII", "PHI"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {isFederal && (
              <>
                <p className={`col-span-2 ${sectionHeadCls}`}>Authorizing Official</p>
                <div>
                  <label className={labelCls}>Authorizing Official Name</label>
                  <input value={form.authorizingOfficialName} onChange={(e) => f("authorizingOfficialName", e.target.value)}
                    className={inputCls} placeholder="Full name" />
                </div>
                <div>
                  <label className={labelCls}>Title / Role</label>
                  <input value={form.authorizingOfficialTitle} onChange={(e) => f("authorizingOfficialTitle", e.target.value)}
                    className={inputCls} placeholder="e.g. Chief Information Officer" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            {(!form.systemName || !form.systemOwner || !form.systemOwnerEmail) ? (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Complete required (*) fields to continue
              </p>
            ) : <span />}
            <button onClick={() => setStep(2)}
              disabled={!form.systemName || !form.systemOwner || !form.systemOwnerEmail}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              Next: Environment
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className={labelCls}>Operational Status</label>
              <select value={form.operationalStatus} onChange={(e) => f("operationalStatus", e.target.value)} className={selectCls}>
                {["Operational", "Under Development", "Major Modification", "Planned"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>System Type</label>
              <select value={form.systemType} onChange={(e) => f("systemType", e.target.value)} className={selectCls}>
                {["Cloud-Based", "On-Premise", "Hybrid", "Mobile"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Cloud Provider (if applicable)</label>
              <select value={form.cloudProvider} onChange={(e) => f("cloudProvider", e.target.value)} className={selectCls}>
                {["Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "N/A - On-Premise"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            {/* FIPS 199 - federal only */}
            {isFederal && (
              <>
                <p className={`col-span-2 ${sectionHeadCls}`}>FIPS 199 Security Categorization</p>
                <div>
                  <label className={labelCls}>Confidentiality Impact</label>
                  <select value={form.fips199Confidentiality} onChange={(e) => f("fips199Confidentiality", e.target.value)} className={selectCls}>
                    {IMPACT_LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Integrity Impact</label>
                  <select value={form.fips199Integrity} onChange={(e) => f("fips199Integrity", e.target.value)} className={selectCls}>
                    {IMPACT_LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Availability Impact</label>
                  <select value={form.fips199Availability} onChange={(e) => f("fips199Availability", e.target.value)} className={selectCls}>
                    {IMPACT_LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">Overall Impact Level</p>
                    <p className="text-lg font-bold text-blue-800">
                      {overallImpact(form.fips199Confidentiality, form.fips199Integrity, form.fips199Availability)}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className={labelCls}>Authorization Boundary Description</label>
              <textarea value={form.authorizationBoundary} onChange={(e) => f("authorizationBoundary", e.target.value)}
                rows={2} className={inputCls} placeholder="Describe the logical and physical boundaries of the system..." />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Network Architecture Description</label>
              <textarea value={form.networkDescription} onChange={(e) => f("networkDescription", e.target.value)}
                rows={2} className={inputCls} placeholder="Describe network topology, data flows, and external connections..." />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>User Types and Access (optional)</label>
              <textarea value={form.userTypesDescription} onChange={(e) => f("userTypesDescription", e.target.value)}
                rows={3} className={inputCls}
                placeholder={"e.g. Privileged Users (Admins): ~5 internal, MFA required\nStandard Users (Internal): ~200, SSO via Okta\nExternal Users (API clients): ~50 third-party systems, API key + OAuth"} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Ports, Protocols, and Services (optional)</label>
              <textarea value={form.portsProtocolsServices} onChange={(e) => f("portsProtocolsServices", e.target.value)}
                rows={3} className={inputCls}
                placeholder={"e.g. 443/TCP (HTTPS) - Inbound - Web application traffic\n22/TCP (SSH) - Outbound - Infrastructure management (restricted)\n587/TCP (SMTP/TLS) - Outbound - Transactional email"} />
            </div>

            {isFederal && (
              <div className="col-span-2">
                <label className={labelCls}>Cryptographic Modules - FIPS 140-2/3 (optional)</label>
                <textarea value={form.cryptographicModules} onChange={(e) => f("cryptographicModules", e.target.value)}
                  rows={3} className={inputCls}
                  placeholder={"e.g. AWS KMS (FIPS 140-2 Level 2 validated)\nAWS ACM/TLS 1.3 (FIPS 140-2 validated)\nOpenSSL 3.0 FIPS Provider (FIPS 140-3 Level 1)"} />
              </div>
            )}

            <div className="col-span-2">
              <label className={labelCls}>External System Interconnections (optional)</label>
              <textarea value={form.externalConnections} onChange={(e) => f("externalConnections", e.target.value)}
                rows={2} className={inputCls}
                placeholder="List external systems that connect to or exchange data with this system..." />
            </div>

            {/* Applicable laws */}
            {(LAWS_BY_FRAMEWORK[form.frameworkKey] ?? []).length > 0 && (
              <div className="col-span-2">
                <p className={sectionHeadCls}>Applicable Laws and Regulations</p>
                <div className="space-y-2">
                  {(LAWS_BY_FRAMEWORK[form.frameworkKey] ?? []).map((law) => (
                    <label key={law} className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.applicableLaws.includes(law)}
                        onChange={() => toggleLaw(law)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{law}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-5 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back: System Info
              </button>
            <button onClick={() => generateMutation.mutate(form)} disabled={generateMutation.isPending}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {generateMutation.isPending ? "Generating SSP..." : "Generate SSP"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && generated && cs && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800">SSP Generated Successfully</p>
              <p className="text-sm text-green-600 mt-0.5">
                {cs.implemented}/{cs.totalControls} controls implemented ({Math.round((cs.implemented / cs.totalControls) * 100)}%)
              </p>
            </div>
            <button onClick={handleExportPdf}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as PDF
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-blue-700">
              "Export as PDF" opens a formatted preview in a new tab. Use Print (Ctrl/Cmd+P) and select "Save as PDF". The document includes a cover page, FIPS 199 categorization, applicable laws, user types, ports/protocols, cryptographic modules, and all control implementations with origination codes.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><span className="text-slate-500">System:</span> <span className="font-medium text-slate-800">{generated.system?.name}</span></div>
                <div><span className="text-slate-500">Framework:</span> <span className="font-medium text-slate-800">{FRAMEWORK_LABELS[generated.framework?.toLowerCase()] ?? generated.framework?.toUpperCase()}</span></div>
                <div><span className="text-slate-500">Owner:</span> <span className="font-medium text-slate-800">{generated.system?.owner}</span></div>
                <div><span className="text-slate-500">Classification:</span> <span className="font-medium text-slate-800">{generated.system?.dataClassification}</span></div>
                {generated.system?.overallImpactLevel && (
                  <div><span className="text-slate-500">FIPS 199 Level:</span> <span className="font-medium text-slate-800">{generated.system.overallImpactLevel}</span></div>
                )}
                {generated.system?.authorizingOfficialName && (
                  <div><span className="text-slate-500">AO:</span> <span className="font-medium text-slate-800">{generated.system.authorizingOfficialName}</span></div>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {(generated.controlSections ?? []).map((c: any) => (
                <div key={c.controlId} className="px-5 py-3 flex items-start gap-4">
                  <span className="text-xs font-mono font-semibold text-slate-500 w-24 flex-shrink-0 pt-0.5">{c.controlId}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{c.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.implementationStatus === "Implemented" ? "bg-green-50 text-green-700" : c.implementationStatus === "Planned" ? "bg-yellow-50 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.implementationStatus}
                      </span>
                      {c.origination && c.origination !== "System Specific" && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">{c.origination}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.implementationStatement}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setGenerated(null); }}
              className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              New SSP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
