import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db,
  orgAssessmentsTable,
  orgQuestionnairesTable,
  orgQuestionnaireItemsTable,
  orgControlResultsTable,
  orgEvidenceTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "placeholder";
const openai = new OpenAI({
  ...(openaiBaseURL ? { baseURL: openaiBaseURL } : {}),
  apiKey: openaiApiKey,
});

// ─── Zero Trust Posture Assessment question template ────────────────────────
const ZT_QUESTIONS = {
  identity: [
    "Do you enforce Multi-Factor Authentication (MFA) for all user accounts?",
    "Do you use Single Sign-On (SSO) across all enterprise applications?",
    "Do you have a formal Identity and Access Management (IAM) policy?",
    "Do you enforce Role-Based Access Control (RBAC) with least privilege?",
    "Do you conduct periodic access reviews (at least annually)?",
    "Do you have Privileged Access Management (PAM) for admin/service accounts?",
    "Do you have automated user provisioning and de-provisioning processes?",
  ],
  devices: [
    "Do you have a Mobile Device Management (MDM) or endpoint management solution?",
    "Are all corporate devices enrolled in your MDM platform?",
    "Do you enforce device health checks before granting access to resources?",
    "Is full-disk encryption enabled on all corporate endpoints?",
    "Do you run endpoint detection and response (EDR) or antivirus on all devices?",
    "Do you have a formal patch management policy with defined SLAs?",
    "Are personal/BYOD devices managed or restricted from accessing corporate data?",
  ],
  network: [
    "Have you implemented network micro-segmentation or VLAN segregation?",
    "Do you use a Web Application Firewall (WAF) or equivalent DDoS protection?",
    "Do you enforce TLS 1.2+ encryption for all data in transit?",
    "Do you use DNS filtering or Secure Web Gateway for internet traffic?",
    "Is remote access provided via Zero Trust Network Access (ZTNA) or VPN with MFA?",
    "Do you monitor network traffic for anomalies (SIEM, IDS/IPS)?",
    "Do you maintain a network topology diagram updated within the last 12 months?",
  ],
  applications: [
    "Do you perform static application security testing (SAST) in your CI/CD pipeline?",
    "Do you conduct dynamic application security testing (DAST) or penetration testing?",
    "Do you have a formal Software Development Lifecycle (SDLC) with security gates?",
    "Do you perform dependency scanning for known vulnerabilities (SCA)?",
    "Is API access authenticated with short-lived tokens (OAuth 2.0/JWT)?",
    "Do you have a vulnerability disclosure or bug bounty program?",
    "Do you use container image scanning in your deployment pipeline?",
  ],
  data: [
    "Do you have a formal data classification policy (Public, Internal, Confidential, Restricted)?",
    "Is sensitive data encrypted at rest using AES-256 or equivalent?",
    "Do you know where all CUI, PII, and sensitive data resides (data inventory)?",
    "Do you enforce data loss prevention (DLP) controls?",
    "Do you have a formal data retention and destruction policy?",
    "Are backups of critical data performed and tested regularly?",
    "Do you restrict data access on a need-to-know basis with documented justification?",
  ],
  governance: [
    "Do you have a documented Information Security Policy reviewed annually?",
    "Do you conduct annual security awareness training for all employees?",
    "Do you have a formal Incident Response Plan (IRP) tested at least annually?",
    "Do you have a Business Continuity / Disaster Recovery plan?",
    "Do you perform annual risk assessments?",
    "Do you have a vendor/third-party risk management program?",
    "Do you maintain an inventory of all IT assets (hardware and software)?",
  ],
  compliance: [
    "Are you pursuing or do you hold any compliance certifications (SOC 2, ISO 27001, FedRAMP, CMMC)?",
    "Do you have a Plan of Action and Milestones (POA&M) for open compliance gaps?",
    "Do you use a GRC platform to manage compliance controls and evidence?",
    "Do you conduct internal audits of your security controls at least annually?",
    "Do you have a formal compliance program owner or dedicated security team?",
    "Is audit log data retained for at least 12 months?",
    "Do you have controls mapped to NIST 800-171, CMMC, or equivalent frameworks?",
  ],
  operations: [
    "Do you have a centralized SIEM or log management platform?",
    "Do you have defined Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?",
    "Do you conduct tabletop exercises or incident response drills?",
    "Do you perform vulnerability scanning at least monthly?",
    "Do you have an on-call escalation process for critical security incidents?",
    "Do you track and remediate findings from penetration tests within defined SLAs?",
    "Do you monitor third-party advisories and apply patches within 30 days for critical CVEs?",
  ],
};

function buildZTQuestions(): Array<{ question: string; domain: string; index: number }> {
  const list: Array<{ question: string; domain: string; index: number }> = [];
  let idx = 0;
  for (const [domain, questions] of Object.entries(ZT_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain, index: idx++ });
    }
  }
  return list;
}
// ─── NIST 800-171 Readiness Assessment (14 control families) ───────────────
const NIST_171_QUESTIONS = [
  "Do you control who can access your systems and data (Access Control — 3.1)?",
  "Do you conduct security awareness training for all users (Awareness & Training — 3.2)?",
  "Do you maintain audit logs of system access and activity (Audit — 3.3)?",
  "Do you manage system configuration and change management (Configuration — 3.4)?",
  "Do you verify the identity of users before granting access (Identification & Auth — 3.5)?",
  "Do you have an incident response plan and process (Incident Response — 3.6)?",
  "Do you perform maintenance on systems and control who does it (Maintenance — 3.7)?",
  "Do you protect sensitive media and control physical access to it (Media Protection — 3.8)?",
  "Do you screen personnel before granting access to CUI (Personnel Security — 3.9)?",
  "Do you protect your facilities and limit physical access to systems (Physical Protection — 3.10)?",
  "Do you assess security risks and remediate identified gaps (Risk Assessment — 3.11)?",
  "Do you have a security assessment program for your controls (Security Assessment — 3.12)?",
  "Do you protect communications and control what data leaves your network (System & Comms Protection — 3.13)?",
  "Do you protect system integrity and perform vulnerability management (System Integrity — 3.14)?",
];

// ─── CMMC Level 2 Readiness (subset of 110 NIST 800-171 practices) ─────────
const CMMC_L2_QUESTIONS = [
  "Can you demonstrate documented policies for all 14 NIST 800-171 control families?",
  "Do you have written procedures for Access Control (AC) practices?",
  "Is MFA implemented for all privileged and remote access?",
  "Do you use encryption for CUI stored on mobile devices and removable media?",
  "Do you have a documented System Security Plan (SSP) for your CUI environment?",
  "Do you sanitize or destroy media containing CUI before disposal?",
  "Do you perform background checks on individuals with access to CUI?",
  "Do you limit system access to authorized users, processes, and devices?",
  "Do you protect audit information from unauthorized access or modification?",
  "Do you scan for vulnerabilities in systems processing CUI periodically?",
  "Do you use deny-by-default / allow-by-exception for security configurations?",
  "Do you monitor systems to detect attacks and unauthorized access?",
  "Do you control remote access sessions and encrypt all remote access communications?",
  "Do you provide CUI protection training to personnel handling CUI?",
  "Do you have a continuous monitoring capability for your CUI environment?",
];

// ─── SOC 2 Type II Readiness (Trust Services Criteria CC1–CC9 + A1) ─────────
const SOC2_QUESTIONS = [
  "Do you have a formal information security policy reviewed at least annually? (CC1.1)",
  "Do you perform background checks on employees with access to customer data? (CC1.1)",
  "Do you conduct security awareness training annually? (CC1.4)",
  "Do you enforce MFA for logical access to systems? (CC6.1)",
  "Do you have a formal change management process for infrastructure? (CC8.1)",
  "Do you perform penetration testing at least annually? (CC4.1)",
  "Do you have a Business Continuity Plan (BCP) tested annually? (A1.3)",
  "Do you maintain audit logs retained for at least 12 months? (CC7.2)",
  "Do you have a SIEM or centralized log monitoring system? (CC7.2)",
  "Do you have documented Incident Response procedures? (CC7.3)",
  "Do you perform vendor risk assessments for critical third parties? (CC9.2)",
  "Do you encrypt customer data at rest and in transit? (CC6.7)",
  "Do you have a formal vulnerability management program? (CC7.1)",
  "Do you perform access reviews at least semi-annually? (CC6.2)",
  "Do you have a documented data classification policy? (CC6.5)",
];

// ─── FedRAMP Moderate Readiness (NIST 800-53 Rev 5, 17 control families) ───
const FEDRAMP_MOD_QUESTIONS = {
  access_control: [
    "Do you enforce least privilege access and restrict user permissions to job functions only? (AC-2, AC-6)",
    "Is MFA enforced for all privileged users and remote access to federal systems? (AC-17, IA-2)",
    "Do you have automated account management processes including provisioning and de-provisioning? (AC-2)",
    "Do you enforce session lock with inactivity timeouts of 15 minutes or less? (AC-11)",
    "Do you restrict access to systems to authorized federal personnel and contractors only? (AC-3)",
  ],
  audit_accountability: [
    "Do you collect and retain audit logs for a minimum of 90 days online and 1 year archived? (AU-11)",
    "Are audit records protected from unauthorized modification and deletion? (AU-9)",
    "Do you review audit logs for anomalies and security events at least weekly? (AU-6)",
    "Do you maintain audit logs for all privileged actions, login/logoff, and configuration changes? (AU-2)",
    "Do you have automated alerts for audit log failures or anomalous patterns? (AU-5)",
  ],
  configuration_management: [
    "Do you maintain a baseline configuration for all system components and enforce it? (CM-2, CM-6)",
    "Do you operate with a deny-all/permit-by-exception policy for software and services? (CM-7)",
    "Do you have a formal change control board (CCB) or equivalent process for all changes? (CM-3)",
    "Are all software and firmware components tracked in a configuration inventory? (CM-8)",
    "Do you perform security impact analysis for all proposed configuration changes? (CM-4)",
  ],
  contingency_planning: [
    "Do you have a FedRAMP-compatible Contingency Plan (CP) that has been tested within 12 months? (CP-2, CP-4)",
    "Do you have defined RTO and RPO for each federal system? (CP-2)",
    "Are backups of federal system data performed, encrypted, and tested regularly? (CP-9)",
    "Do you have alternate processing sites available for continuity of federal operations? (CP-7)",
    "Do you conduct annual contingency plan training for personnel? (CP-3)",
  ],
  identification_authentication: [
    "Do you use PIV/CAC cards or equivalent strong authentication for federal system access? (IA-2, IA-5)",
    "Are authenticator (password/token) management policies enforced with minimum complexity requirements? (IA-5)",
    "Do you uniquely identify and authenticate all users, processes, and devices? (IA-2, IA-3)",
    "Do you enforce MFA for all network access to privileged accounts and all non-privileged access to federal systems? (IA-2)",
    "Do you manage service account credentials with defined rotation schedules? (IA-5)",
  ],
  incident_response: [
    "Do you have a US-CERT/CISA-compliant incident response plan with defined reporting timelines? (IR-6)",
    "Are security incidents reported to FedRAMP PMO and AO within required timeframes (1 hour for major)? (IR-6)",
    "Do you conduct incident response testing at least annually? (IR-3)",
    "Do you track, document, and report all security incidents per FISMA requirements? (IR-5, IR-6)",
    "Do you have a defined incident handling capability covering detection, analysis, containment, and recovery? (IR-4)",
  ],
  maintenance: [
    "Do you control and monitor maintenance activities on federal systems? (MA-2)",
    "Are maintenance tools controlled and sanitized before use on federal systems? (MA-3)",
    "Do you require MFA for remote maintenance sessions on federal systems? (MA-4)",
    "Is maintenance by non-local personnel supervised by authorized staff? (MA-5)",
    "Do you maintain records of all maintenance activities including dates and personnel? (MA-2)",
  ],
  media_protection: [
    "Do you encrypt all digital media containing federal data using FIPS 140-2/3 validated modules? (MP-5)",
    "Is media sanitized prior to disposal using NIST 800-88 methods? (MP-6)",
    "Do you mark all media containing federal information with appropriate classification? (MP-3)",
    "Is access to system media restricted to authorized personnel? (MP-2)",
    "Do you track and document all media transport and transfers? (MP-5)",
  ],
  personnel_security: [
    "Do all personnel with access to federal systems have appropriate background investigations? (PS-3)",
    "Do you have formal personnel termination procedures including access revocation? (PS-4)",
    "Are personnel transfers handled with reassessment of access rights and notifications? (PS-5)",
    "Do you require all personnel to sign security agreements and acceptable use policies? (PS-6)",
    "Are sanctions applied for policy violations documented and enforced? (PS-8)",
  ],
  risk_assessment: [
    "Do you conduct formal risk assessments at least annually or upon major changes? (RA-3)",
    "Do you perform vulnerability scanning of federal systems at least monthly? (RA-5)",
    "Are vulnerability scan results analyzed and remediated within defined timeframes (30 days for critical)? (RA-5, SI-2)",
    "Do you perform authenticated vulnerability scans on all system components? (RA-5)",
    "Do you maintain a current risk register and POA&M for open findings? (CA-5)",
  ],
  security_assessment: [
    "Do you have a current Authority to Operate (ATO) or are you pursuing FedRAMP authorization? (CA-1)",
    "Do you conduct annual security control assessments by a 3PAO or independent assessor? (CA-2)",
    "Do you maintain a current System Security Plan (SSP) aligned to FedRAMP templates? (PL-2)",
    "Is your POA&M reviewed and updated monthly? (CA-5)",
    "Do you perform penetration testing at least annually per FedRAMP requirements? (CA-8)",
  ],
  system_comms_protection: [
    "Do you encrypt all federal data in transit using FIPS 140-2/3 validated cryptography? (SC-8)",
    "Have you implemented network segmentation isolating your federal boundary? (SC-7)",
    "Do you use FIPS-validated cryptographic modules for all sensitive data protection? (SC-13)",
    "Are all public-facing interfaces protected by WAF and DDoS mitigation? (SC-5, SC-7)",
    "Do you employ flow control enforcement for sensitive data crossing boundary protection points? (SC-7)",
  ],
  system_integrity: [
    "Do you run endpoint protection software (antivirus/EDR) on all federal system components? (SI-3)",
    "Are security alerts and advisories monitored and responded to in a timely manner? (SI-5)",
    "Do you perform integrity verification on software and firmware prior to installation? (SI-7)",
    "Do you have input validation controls for all web applications handling federal data? (SI-10)",
    "Is spam and malicious code protection implemented at mail gateways and endpoints? (SI-8)",
  ],
};

function buildFedRAMPQuestions(): Array<{ question: string; domain: string }> {
  const list: Array<{ question: string; domain: string }> = [];
  for (const [domain, questions] of Object.entries(FEDRAMP_MOD_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain });
    }
  }
  return list;
}
// ─── CMMC Level 3 Readiness (NIST 800-172 advanced practices, 110+ controls) ─
const CMMC_L3_QUESTIONS = {
  access_control: [
    "Do you enforce attribute-based access control (ABAC) or dynamic access decisions beyond RBAC? (AC-3(13))",
    "Do you employ automated mechanisms to support account management and access enforcement? (AC-2(1))",
    "Do you restrict access to systems to authorized connections only using allowlisting? (AC-17(2))",
    "Are privileged access sessions monitored and recorded in real-time? (AC-17(9))",
  ],
  advanced_threat_protection: [
    "Do you employ threat hunting capabilities to proactively detect advanced persistent threats? (SI-4(24))",
    "Do you use deception technologies (honeypots, honeynets) to detect lateral movement? (SC-26)",
    "Do you have a Cyber Threat Intelligence (CTI) program that informs defensive operations? (RA-10)",
    "Do you correlate audit log data from multiple sources using SIEM/SOAR to detect APT activity? (AU-6(5))",
    "Do you employ advanced analytics (UEBA/ML) for anomaly detection on network and user behavior? (SI-4(25))",
  ],
  configuration_management: [
    "Do you employ automated mechanisms to detect unauthorized software on CUI systems? (CM-7(5))",
    "Do you maintain a deny-all/permit-by-exception software execution policy enforced technically? (CM-7(2))",
    "Are security configuration settings enforced through Group Policy, SCCM, or equivalent? (CM-6(1))",
    "Do you track and manage all CUI system components using an automated asset inventory? (CM-8(3))",
  ],
  incident_response: [
    "Do you have a dedicated Security Operations Center (SOC) or managed SOC capability? (IR-7(1))",
    "Do you employ automated incident handling and response orchestration (SOAR)? (IR-4(1))",
    "Can you dynamically reconfigure boundary protection systems in response to active incidents? (IR-4(9))",
    "Do you coordinate incident response with external agencies (CISA, US-CERT) when required? (IR-6(2))",
  ],
  risk_management: [
    "Do you have a supply chain risk management (SCRM) program covering all CUI-related suppliers? (SR-3, SR-5)",
    "Do you conduct formal risk analysis using validated frameworks (NIST RMF, FAIR)? (RA-3(1))",
    "Do you perform red team / adversarial simulation exercises at least annually? (CA-8(2))",
    "Do you have a documented software bill of materials (SBOM) for all software in your CUI environment? (SR-4)",
  ],
  system_integrity: [
    "Do you employ hardware root-of-trust (TPM, Secure Boot) on all CUI systems? (SI-7(9))",
    "Do you use code signing to ensure integrity of all software deployed in the CUI environment? (SI-7(6))",
    "Do you have runtime application self-protection (RASP) or equivalent for CUI applications? (SI-16)",
    "Do you perform integrity verification of security-critical software components during startup? (SI-7(1))",
  ],
};

function buildCMMCL3Questions(): Array<{ question: string; domain: string }> {
  const list: Array<{ question: string; domain: string }> = [];
  for (const [domain, questions] of Object.entries(CMMC_L3_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain });
    }
  }
  return list;
}

// ─── ISO 27001:2022 Readiness Assessment (14 control clauses, Annex A) ──────
const ISO27001_QUESTIONS = {
  organizational_controls: [
    "Do you have a documented Information Security Management System (ISMS) aligned to ISO 27001:2022? (Clause 4–6)",
    "Is there a defined information security policy approved by top management? (A.5.1)",
    "Do you maintain a complete inventory of information assets with defined ownership? (A.5.9)",
    "Do you have a formal acceptable use policy for information and assets? (A.5.10)",
    "Do you have documented procedures for information classification and labeling? (A.5.12, A.5.13)",
    "Is there a documented and tested information security incident management process? (A.5.24–A.5.28)",
    "Do you have a supplier/third-party security policy and conduct supplier risk assessments? (A.5.19–A.5.22)",
    "Do you have a documented business continuity plan for information security? (A.5.29–A.5.30)",
  ],
  people_controls: [
    "Are security responsibilities included in employment terms and conditions? (A.6.2)",
    "Do all employees receive security awareness training appropriate to their role? (A.6.3)",
    "Is there a formal disciplinary process for information security policy violations? (A.6.4)",
    "Are access rights revoked promptly upon termination or role change? (A.6.5)",
    "Do employees with remote access comply with documented remote working security requirements? (A.6.7)",
  ],
  physical_controls: [
    "Are physical security perimeters defined and implemented to protect sensitive areas? (A.7.1)",
    "Is access to sensitive physical areas controlled and monitored? (A.7.2, A.7.3)",
    "Are systems protected from environmental threats (fire, flood, power failure)? (A.7.5)",
    "Is equipment secured against physical theft or unauthorized access when outside premises? (A.7.9)",
    "Are storage media securely disposed of or reused per formal procedures? (A.7.10)",
  ],
  technological_controls: [
    "Are privileged access rights restricted, controlled, and regularly reviewed? (A.8.2)",
    "Is information access controlled based on documented access control policies? (A.8.3)",
    "Is source code and development infrastructure protected from unauthorized access? (A.8.4)",
    "Is authentication implemented using secure practices (MFA, strong passwords)? (A.8.5)",
    "Do you employ cryptographic controls to protect sensitive information? (A.8.24)",
    "Do you have malware protection on all user endpoints and servers? (A.8.7)",
    "Do you perform regular backups with defined retention periods and test restoration? (A.8.13)",
    "Are security events logged, monitored, and retained for audit purposes? (A.8.15, A.8.16)",
    "Are networks monitored and managed to protect systems and applications? (A.8.20, A.8.21)",
    "Do you perform application security testing and secure code reviews? (A.8.25–A.8.29)",
    "Do you have formal vulnerability management and patch processes? (A.8.8)",
    "Are web filtering and network access restrictions implemented? (A.8.23)",
  ],
};

function buildISO27001Questions(): Array<{ question: string; domain: string }> {
  const list: Array<{ question: string; domain: string }> = [];
  for (const [domain, questions] of Object.entries(ISO27001_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain });
    }
  }
  return list;
}
// ─── HIPAA Security Rule Readiness Assessment ───────────────────────────────
const HIPAA_QUESTIONS = {
  administrative_safeguards: [
    "Do you have a Security Officer designated with documented responsibilities for HIPAA compliance? (§164.308(a)(2))",
    "Have you conducted a formal, documented risk analysis of all ePHI systems? (§164.308(a)(1)(ii)(A))",
    "Do you have a risk management plan to reduce identified ePHI risks to a reasonable level? (§164.308(a)(1)(ii)(B))",
    "Do you have documented workforce training on HIPAA security requirements? (§164.308(a)(5))",
    "Do you have formal access management procedures for ePHI systems? (§164.308(a)(4))",
    "Do you have contingency plans (backup, disaster recovery, emergency mode) for ePHI? (§164.308(a)(7))",
    "Do you evaluate security measures periodically or after environmental changes? (§164.308(a)(8))",
    "Do you have Business Associate Agreements (BAAs) with all vendors handling ePHI? (§164.308(b)(1))",
  ],
  physical_safeguards: [
    "Do you have facility access controls restricting physical access to ePHI systems? (§164.310(a))",
    "Do you control and validate workstation use for employees accessing ePHI? (§164.310(b))",
    "Are workstations positioned to prevent unauthorized viewing of ePHI? (§164.310(c))",
    "Do you have disposal and re-use procedures for hardware containing ePHI? (§164.310(d)(2)(i,ii))",
    "Do you maintain records of hardware movements and transfers involving ePHI? (§164.310(d)(2)(iii,iv))",
  ],
  technical_safeguards: [
    "Do you have unique user identification for all personnel accessing ePHI? (§164.312(a)(2)(i))",
    "Do you have emergency access procedures for ePHI during crises? (§164.312(a)(2)(ii))",
    "Do you implement automatic logoff for workstations accessing ePHI? (§164.312(a)(2)(iii))",
    "Do you encrypt ePHI stored on portable devices and workstations? (§164.312(a)(2)(iv))",
    "Do you have audit controls to record and examine ePHI access activity? (§164.312(b))",
    "Do you implement integrity controls to prevent improper alteration of ePHI? (§164.312(c))",
    "Do you encrypt ePHI transmitted over electronic communications networks? (§164.312(e)(1,2))",
    "Do you authenticate users and entities before granting access to ePHI? (§164.312(d))",
  ],
  breach_notification: [
    "Do you have a documented Breach Notification Policy covering all required timelines? (§164.400–414)",
    "Can you detect and investigate potential ePHI breaches within required timeframes?",
    "Do you notify affected individuals within 60 days of discovering a breach? (§164.404)",
    "Do you report breaches affecting 500+ individuals to HHS within 60 days? (§164.408)",
    "Do you maintain a breach log and submit annual reports to HHS for smaller breaches? (§164.408(c))",
  ],
};

function buildHIPAAQuestions(): Array<{ question: string; domain: string }> {
  const list: Array<{ question: string; domain: string }> = [];
  for (const [domain, questions] of Object.entries(HIPAA_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain });
    }
  }
  return list;
}

// ─── PCI DSS v4.0 Readiness Assessment (12 requirements) ───────────────────
const PCI_DSS_QUESTIONS = {
  network_security: [
    "Do you install and maintain network security controls (firewalls) to protect cardholder data? (Req 1)",
    "Have you changed all vendor-supplied default credentials and removed unnecessary default accounts? (Req 2.2)",
    "Do you maintain a documented network diagram showing all cardholder data flows? (Req 1.2)",
    "Is the cardholder data environment (CDE) isolated from untrusted networks? (Req 1.3)",
  ],
  data_protection: [
    "Do you know exactly where all cardholder data is stored, processed, and transmitted? (Req 3.1)",
    "Is stored cardholder data protected (encrypted, hashed, or truncated) per PCI DSS requirements? (Req 3.4)",
    "Do you encrypt cardholder data transmitted over open/public networks using strong cryptography? (Req 4.2)",
    "Have you implemented key management procedures for cryptographic keys protecting cardholder data? (Req 3.7)",
    "Is Primary Account Number (PAN) masked when displayed (first 6/last 4)? (Req 3.3.1)",
  ],
  vulnerability_management: [
    "Do you maintain anti-malware protection on all systems commonly affected by malware? (Req 5)",
    "Do you have a formal vulnerability management program with defined patch SLAs? (Req 6.3)",
    "Do you perform internal and external vulnerability scans quarterly using an ASV? (Req 11.3)",
    "Do you perform penetration testing at least annually and after significant changes? (Req 11.4)",
    "Do you run a web application firewall or perform code reviews for all public-facing web apps? (Req 6.4)",
  ],
  access_control: [
    "Is access to cardholder data restricted on a need-to-know basis with documented approval? (Req 7)",
    "Does every user have a unique ID for accessing system components? (Req 8.2)",
    "Is MFA implemented for all non-console access into the CDE and all remote access? (Req 8.4)",
    "Are physical access to cardholder data and systems controlled and monitored? (Req 9)",
    "Are access rights reviewed at least every 6 months? (Req 7.2.4)",
  ],
  monitoring_testing: [
    "Do you have mechanisms to detect and alert on the use of critical file changes? (Req 11.5)",
    "Is all access to system components and cardholder data logged? (Req 10.2)",
    "Are audit logs retained for at least 12 months with 3 months immediately available? (Req 10.7)",
    "Do you monitor all critical system component logs daily or using automated alerts? (Req 10.4)",
    "Have you deployed intrusion detection or prevention systems in the CDE? (Req 11.5)",
  ],
  security_policies: [
    "Do you have an information security policy that is reviewed at least annually? (Req 12.1)",
    "Is there a formal security awareness program with annual training for all personnel? (Req 12.6)",
    "Do you conduct thorough background checks on employees before granting CDE access? (Req 12.7)",
    "Is there a defined Incident Response Plan specifically covering payment card data breaches? (Req 12.10)",
    "Do you manage and oversee the security posture of all third-party service providers? (Req 12.8, 12.9)",
  ],
};

function buildPCIDSSQuestions(): Array<{ question: string; domain: string }> {
  const list: Array<{ question: string; domain: string }> = [];
  for (const [domain, questions] of Object.entries(PCI_DSS_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain });
    }
  }
  return list;
}
// ─── ASSESSMENT_TEMPLATES: All frameworks ───────────────────────────────────
export const ASSESSMENT_TEMPLATES: Record<string, {
  label: string;
  description: string;
  domains: string[];
  questions: Array<{ question: string; domain: string }>;
}> = {
  "zero-trust": {
    label: "Zero Trust Posture Assessment",
    description: "Comprehensive 56-question assessment across 8 Zero Trust domains: Identity, Devices, Network, Applications, Data, Governance, Compliance, and Operations.",
    domains: ["identity", "devices", "network", "applications", "data", "governance", "compliance", "operations"],
    questions: buildZTQuestions(),
  },
  "nist-800-171": {
    label: "NIST 800-171 Readiness Assessment",
    description: "14-question intake covering all NIST 800-171 control families. Used for CMMC L2 eligibility and DoD contract readiness.",
    domains: ["access_control", "awareness", "audit", "configuration", "identification", "incident_response", "maintenance", "media_protection", "personnel", "physical", "risk", "security_assessment", "system_comms", "system_integrity"],
    questions: NIST_171_QUESTIONS.map((q) => ({ question: q, domain: "nist-171" })),
  },
  "cmmc-l2": {
    label: "CMMC Level 2 Readiness Assessment",
    description: "15-question CMMC Level 2 readiness assessment covering key practice areas for organizations handling CUI under DoD contracts.",
    domains: ["access_control", "identification", "media_protection", "personnel", "risk_assessment", "system_integrity"],
    questions: CMMC_L2_QUESTIONS.map((q) => ({ question: q, domain: "cmmc-l2" })),
  },
  "cmmc-l3": {
    label: "CMMC Level 3 Advanced Readiness Assessment",
    description: "21-question CMMC Level 3 readiness assessment targeting advanced persistent threat (APT) protection practices per NIST 800-172, for organizations on the Defense Industrial Base Sector Enterprise (DIBSE) critical contractor list.",
    domains: ["access_control", "advanced_threat_protection", "configuration_management", "incident_response", "risk_management", "system_integrity"],
    questions: buildCMMCL3Questions(),
  },
  "soc2": {
    label: "SOC 2 Type II Readiness Assessment",
    description: "15-question SOC 2 Trust Services Criteria readiness check covering CC1–CC9 and Availability criteria.",
    domains: ["CC1", "CC4", "CC6", "CC7", "CC8", "CC9", "A1"],
    questions: SOC2_QUESTIONS.map((q) => ({ question: q, domain: "soc2" })),
  },
  "fedramp-moderate": {
    label: "FedRAMP Moderate Readiness Assessment",
    description: "65-question FedRAMP Moderate baseline readiness assessment covering all 13 NIST 800-53 Rev 5 control families required for cloud service providers seeking federal authorization. Aligned to the FedRAMP Moderate Impact Level.",
    domains: ["access_control", "audit_accountability", "configuration_management", "contingency_planning", "identification_authentication", "incident_response", "maintenance", "media_protection", "personnel_security", "risk_assessment", "security_assessment", "system_comms_protection", "system_integrity"],
    questions: buildFedRAMPQuestions(),
  },
  "iso-27001": {
    label: "ISO 27001:2022 Readiness Assessment",
    description: "25-question ISO 27001:2022 ISMS readiness assessment covering organizational, people, physical, and technological controls across Annex A. Suitable for organizations pursuing ISO 27001 certification or international market entry.",
    domains: ["organizational_controls", "people_controls", "physical_controls", "technological_controls"],
    questions: buildISO27001Questions(),
  },
  "hipaa": {
    label: "HIPAA Security Rule Readiness Assessment",
    description: "26-question HIPAA Security Rule readiness assessment covering Administrative, Physical, and Technical Safeguards plus Breach Notification requirements for organizations handling electronic Protected Health Information (ePHI).",
    domains: ["administrative_safeguards", "physical_safeguards", "technical_safeguards", "breach_notification"],
    questions: buildHIPAAQuestions(),
  },
  "pci-dss": {
    label: "PCI DSS v4.0 Readiness Assessment",
    description: "28-question PCI DSS v4.0 readiness assessment spanning all 12 requirements for organizations that store, process, or transmit payment cardholder data. Covers network security, data protection, vulnerability management, access control, monitoring, and security policies.",
    domains: ["network_security", "data_protection", "vulnerability_management", "access_control", "monitoring_testing", "security_policies"],
    questions: buildPCIDSSQuestions(),
  },
};
@Injectable()
export class AssessmentsService {
  // ── List all assessments for an org ──────────────────────────────────────────
  async list(orgId: number) {
    const assessments = await db.query.orgAssessmentsTable.findMany({
      where: eq(orgAssessmentsTable.orgId, orgId),
      orderBy: [desc(orgAssessmentsTable.createdAt)],
    });
    return { assessments };
  }

  // ── Get a single assessment with its questionnaire items ─────────────────────
  async getById(orgId: number, id: number) {
    const assessment = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!assessment) throw new NotFoundException("Assessment not found");
    let items: any[] = [];
    if (assessment.questionnaireId) {
      const itemsResult = await db.query.orgQuestionnaireItemsTable.findMany({
        where: and(
          eq(orgQuestionnaireItemsTable.orgId, orgId),
          eq(orgQuestionnaireItemsTable.questionnaireId, assessment.questionnaireId),
        ),
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      });
      items = itemsResult;
    }
    return { assessment, items };
  }

  // ── Create a new assessment engagement ──────────────────────────────────────
  async create(
    orgId: number,
    clerkUserId: string,
    body: {
      clientName: string;
      clientEmail?: string;
      clientCompany?: string;
      clientIndustry?: string;
      clientSize?: string;
      frameworkTarget: string;
      deliveryModel?: string;
      consultantName?: string;
      consultantEmail?: string;
      dueDate?: string;
      notes?: string;
    },
  ) {
    const template = ASSESSMENT_TEMPLATES[body.frameworkTarget];
    if (!template) throw new Error(`Unknown framework target: ${body.frameworkTarget}`);

    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
    });
    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));

    const [questionnaire] = await db.insert(orgQuestionnairesTable).values({
      orgId,
      title: `${template.label} — ${body.clientName}`,
      requesterName: body.clientName,
      requesterCompany: body.clientCompany,
      requesterEmail: body.clientEmail,
      type: body.frameworkTarget,
      totalItems: template.questions.length,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdBy: clerkUserId,
    }).returning();

    const items = await Promise.all(
      template.questions.map(async ({ question, domain }, idx) => {
        const { answer, controlId, confidence } = this.autoAnswer(question, resultMap, evidence, domain);
        return db.insert(orgQuestionnaireItemsTable).values({
          orgId,
          questionnaireId: questionnaire.id,
          question,
          category: domain,
          answer,
          confidence,
          matchedControlId: controlId,
          status: answer ? "answered" : "unanswered",
          sortOrder: idx,
        }).returning();
      }),
    );

    const answered = items.filter((i) => i[0]?.answer).length;
    await db.update(orgQuestionnairesTable)
      .set({ answeredItems: answered })
      .where(eq(orgQuestionnairesTable.id, questionnaire.id));

    const [assessment] = await db.insert(orgAssessmentsTable).values({
      orgId,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientCompany: body.clientCompany,
      clientIndustry: body.clientIndustry,
      clientSize: body.clientSize,
      frameworkTarget: body.frameworkTarget,
      deliveryModel: body.deliveryModel ?? "guided",
      questionnaireId: questionnaire.id,
      consultantName: body.consultantName,
      consultantEmail: body.consultantEmail,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
      createdBy: clerkUserId,
    }).returning();

    return { assessment, questionnaire: { ...questionnaire, answeredItems: answered } };
  }

  // ── Update assessment status / metadata ──────────────────────────────────────
  async update(
    orgId: number,
    id: number,
    body: Partial<{
      clientName: string;
      clientEmail: string;
      clientCompany: string;
      status: string;
      notes: string;
      consultantName: string;
      consultantEmail: string;
      dueDate: string;
    }>,
  ) {
    const existing = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Assessment not found");
    const updates: Record<string, any> = {};
    if (body.clientName !== undefined) updates.clientName = body.clientName;
    if (body.clientEmail !== undefined) updates.clientEmail = body.clientEmail;
    if (body.clientCompany !== undefined) updates.clientCompany = body.clientCompany;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.consultantName !== undefined) updates.consultantName = body.consultantName;
    if (body.consultantEmail !== undefined) updates.consultantEmail = body.consultantEmail;
    if (body.dueDate !== undefined) updates.dueDate = new Date(body.dueDate);
    if (body.status === "complete") updates.completedAt = new Date();
    const [updated] = await db.update(orgAssessmentsTable)
      .set(updates)
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)))
      .returning();
    return { assessment: updated };
  }

  // ── Delete an assessment and its questionnaire ───────────────────────────────
  async delete(orgId: number, id: number) {
    const existing = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Assessment not found");
    if (existing.questionnaireId) {
      await db.delete(orgQuestionnaireItemsTable).where(
        and(
          eq(orgQuestionnaireItemsTable.orgId, orgId),
          eq(orgQuestionnaireItemsTable.questionnaireId, existing.questionnaireId),
        ),
      );
      await db.delete(orgQuestionnairesTable).where(
        and(eq(orgQuestionnairesTable.orgId, orgId), eq(orgQuestionnairesTable.id, existing.questionnaireId)),
      );
    }
    await db.delete(orgAssessmentsTable).where(
      and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    );
    return { success: true };
  }

  // ── Score a completed assessment by domain ───────────────────────────────────
  async score(orgId: number, id: number) {
    const { assessment, items } = await this.getById(orgId, id);
    if (!items.length) return { assessment, domainScores: {}, overallScore: 0, ragStatus: "red" };

    const POSITIVE = ["yes", "we do", "enforced", "implemented", "we have", "we use", "active", "enabled", "deployed", "completed", "annual", "in place"];
    const NEGATIVE = ["no", "we do not", "not yet", "not implemented", "we don't", "gap", "missing", "not deployed", "pending", "not currently"];

    function scoreAnswer(answer: string): number {
      if (!answer) return 0;
      const lower = answer.toLowerCase();
      if (NEGATIVE.some(n => lower.includes(n))) return 0;
      if (POSITIVE.some(p => lower.includes(p))) return 1;
      if (lower.length > 20) return 0.5;
      return 0;
    }

    const domainMap: Record<string, { total: number; score: number }> = {};
    for (const item of items) {
      const domain = item.category || "general";
      if (!domainMap[domain]) domainMap[domain] = { total: 0, score: 0 };
      domainMap[domain].total++;
      domainMap[domain].score += scoreAnswer(item.answer || "");
    }

    const domainScores: Record<string, number> = {};
    for (const [domain, { total, score }] of Object.entries(domainMap)) {
      domainScores[domain] = Math.round((score / total) * 100);
    }

    const allScores = Object.values(domainScores);
    const overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    const ragStatus = overallScore >= 70 ? "green" : overallScore >= 45 ? "amber" : "red";

    const frameworkLabel = ASSESSMENT_TEMPLATES[assessment.frameworkTarget]?.label ?? assessment.frameworkTarget;
    const weakDomains = Object.entries(domainScores)
      .filter(([, s]) => s < 50)
      .sort(([, a], [, b]) => a - b)
      .map(([d, s]) => `${d} (${s}%)`)
      .join(", ");

    let executiveSummary = `${assessment.clientName || "The assessed organization"} achieved an overall maturity score of ${overallScore}% against the ${frameworkLabel}. `;
    executiveSummary += overallScore >= 70
      ? "The organization demonstrates a solid security foundation with strong controls in most domains."
      : overallScore >= 45
      ? `The organization has foundational controls in place but requires targeted improvements. Priority domains: ${weakDomains}.`
      : `Significant gaps exist across multiple security domains. Immediate remediation required. Priority domains: ${weakDomains}.`;

    try {
      const prompt = `You are a senior cybersecurity consultant. Write a 3-sentence executive summary for a ${frameworkLabel} assessment. Client: ${assessment.clientName || "Assessed Organization"}. Industry: ${assessment.clientIndustry || "Technology"}. Overall Score: ${overallScore}%. Domain scores: ${JSON.stringify(domainScores)}. Weakest domains: ${weakDomains || "none identified"}. Be specific, professional, and actionable. Focus on the top 2 risk areas and one immediate action.`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      executiveSummary = response.choices[0]?.message?.content ?? executiveSummary;
    } catch {
      // Use fallback summary
    }

    await db.update(orgAssessmentsTable)
      .set({ domainScores, overallScore, ragStatus, executiveSummary })
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)));

    return { assessment: { ...assessment, domainScores, overallScore, ragStatus, executiveSummary }, domainScores, overallScore, ragStatus };
  }

  // ── Get available templates ───────────────────────────────────────────────────
  async getTemplates() {
    return {
      templates: Object.entries(ASSESSMENT_TEMPLATES).map(([key, t]) => ({
        key,
        label: t.label,
        description: t.description,
        questionCount: t.questions.length,
        domains: t.domains,
      })),
    };
  }

  // ── Store the R2 report URL on the assessment record ─────────────────────────
  async setReportUrl(orgId: number, id: number, reportUrl: string) {
    await db.update(orgAssessmentsTable)
      .set({ reportUrl, reportGeneratedAt: new Date() })
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)));
    return { reportUrl };
  }

  // ── Private: auto-answer a question from org's compliance data ───────────────
  private autoAnswer(
    question: string,
    resultMap: Map<string, { status: string; result?: string | null }>,
    evidence: { title: string; description?: string | null }[],
    domain: string,
  ): { answer: string; controlId?: string; confidence: number } {
    const q = question.toLowerCase();

    // MFA / Multi-factor
    if (q.includes("mfa") || q.includes("multi-factor") || q.includes("two-factor") || q.includes("piv") || q.includes("cac")) {
      const r = resultMap.get("UCO-AI-001");
      if (r?.status === "passing") return { answer: "Yes, MFA is enforced for all user accounts and privileged access via Clerk authentication.", controlId: "UCO-AI-001", confidence: 0.92 };
      if (r?.status === "failing") return { answer: "MFA is not currently enforced for all accounts. This is an identified gap with a remediation plan in place.", controlId: "UCO-AI-001", confidence: 0.88 };
    }
    // SSO
    if (q.includes("sso") || q.includes("single sign-on")) {
      const r = resultMap.get("UCO-AI-002");
      if (r?.status === "passing") return { answer: "Yes, SSO is implemented via Clerk with OIDC support across enterprise applications.", controlId: "UCO-AI-002", confidence: 0.88 };
    }
    // Encryption
    if (q.includes("encrypt") && (q.includes("rest") || q.includes("transit") || q.includes("stored") || q.includes("fips"))) {
      const r = resultMap.get("UCO-DP-002");
      if (r?.status === "passing") return { answer: "Yes, all data is encrypted at rest using AES-256 and in transit using TLS 1.3. FIPS 140-2 validated cryptographic modules are used for federal workloads.", controlId: "UCO-DP-002", confidence: 0.90 };
    }
    // Access Control / RBAC / least privilege
    if (q.includes("access control") || q.includes("rbac") || q.includes("least privilege") || q.includes("role-based") || q.includes("need-to-know")) {
      const r = resultMap.get("UCO-AC-001");
      if (r?.status === "passing") return { answer: "Yes, Role-Based Access Control (RBAC) is enforced with least-privilege principles. Access is granted based on job function and reviewed quarterly.", controlId: "UCO-AC-001", confidence: 0.87 };
    }
    // Access reviews
    if (q.includes("access review") || q.includes("periodic") || q.includes("semi-annual") || q.includes("every 6 months")) {
      const r = resultMap.get("UCO-AC-002");
      if (r?.status === "passing") return { answer: "Yes, formal access reviews are conducted at least semi-annually, with results documented and remediated within 30 days.", controlId: "UCO-AC-002", confidence: 0.84 };
    }
    // Incident Response
    if (q.includes("incident") && (q.includes("response") || q.includes("plan") || q.includes("handling") || q.includes("reporting"))) {
      const r = resultMap.get("UCO-IR-001");
      if (r?.status === "passing") return { answer: "Yes, a documented Incident Response Plan exists, modeled on NIST 800-61. It is reviewed and tabletop-tested annually. US-CERT reporting procedures are included for federal engagements.", controlId: "UCO-IR-001", confidence: 0.87 };
    }
    // Vulnerability management / patching / scanning
    if (q.includes("vulnerab") || q.includes("patch") || q.includes("cve") || q.includes("asv") || q.includes("authenticated scan")) {
      const r = resultMap.get("UCO-VM-001");
      if (r?.status === "passing") return { answer: "Yes, authenticated vulnerability scans are performed weekly. Critical patches are applied within 30 days per our vulnerability management policy. ASV scans are performed quarterly.", controlId: "UCO-VM-001", confidence: 0.85 };
    }
    // Audit logging / SIEM
    if (q.includes("audit log") || q.includes("logging") || q.includes("siem") || q.includes("log management") || q.includes("log retention")) {
      const r = resultMap.get("UCO-AL-001");
      if (r?.status === "passing") return { answer: "Yes, comprehensive audit logging is enabled. Logs are retained for 12 months (3 months immediately accessible) and reviewed via automated alerting.", controlId: "UCO-AL-001", confidence: 0.86 };
    }
    // Training / security awareness
    if (q.includes("training") || q.includes("awareness") || q.includes("workforce training")) {
      const r = resultMap.get("UCO-ST-001");
      if (r?.status === "passing") return { answer: "Yes, all personnel complete annual security awareness training. Role-based training is provided for personnel with elevated access or CUI handling responsibilities.", controlId: "UCO-ST-001", confidence: 0.84 };
    }
    // WAF
    if (q.includes("waf") || q.includes("web application firewall") || q.includes("ddos")) {
      return { answer: "Cloudflare is deployed as our CDN and DDoS protection layer. WAF managed rules are active. Additional tuned rules are on the product roadmap.", confidence: 0.78 };
    }
    // TLS / HTTPS
    if (q.includes("tls") || q.includes("https") || q.includes("in transit") || q.includes("open/public network")) {
      return { answer: "Yes, TLS 1.3 is enforced for all web traffic. HSTS with a 1-year max-age is configured via Cloudflare on all domains. TLS 1.0/1.1 are disabled.", confidence: 0.92 };
    }
    // Change management
    if (q.includes("change management") || q.includes("change control") || q.includes("change board") || q.includes("ccb")) {
      const r = resultMap.get("UCO-CM-001");
      if (r?.status === "passing") return { answer: "Yes, a formal change management process is in place. All changes are peer-reviewed via GitHub pull requests with CODEOWNERS approval. Security impact analysis is performed for significant changes.", controlId: "UCO-CM-001", confidence: 0.86 };
    }
    // Backup / BCP / DR / RTO / RPO / contingency
    if (q.includes("backup") || q.includes("recovery") || q.includes("continuity") || q.includes("rto") || q.includes("rpo") || q.includes("contingency")) {
      return { answer: "Automated daily database backups are performed and encrypted. RTO is 4 hours; RPO is 24 hours. A Contingency Plan is documented and tested annually.", confidence: 0.73 };
    }
    // Certifications / FedRAMP / ATO
    if (q.includes("soc 2") || q.includes("iso 27001") || q.includes("certification") || q.includes("fedramp") || q.includes("ato") || q.includes("authorization")) {
      return { answer: "SOC 2 Type II certification is actively being pursued. FedRAMP readiness assessment is underway. Compliance posture is managed via EnterpriseComply GRC platform.", confidence: 0.80 };
    }
    // Security policy / ISMS
    if (q.includes("security policy") || q.includes("information security policy") || q.includes("isms")) {
      const hasEvidence = evidence.some(e => e.title.toLowerCase().includes("polic"));
      if (hasEvidence) return { answer: "Yes, a formal Information Security Policy and ISMS exist, reviewed annually by senior management, and available to all employees.", confidence: 0.82 };
    }
    // MDM / endpoint management
    if (q.includes("mdm") || q.includes("mobile device management") || q.includes("endpoint management") || q.includes("edr")) {
      return { answer: "EDR is deployed on all corporate endpoints. MDM is on the implementation roadmap. Remote wipe capability is available for managed devices.", confidence: 0.65 };
    }
    // SDLC / code review / SAST / DAST
    if (q.includes("sdlc") || q.includes("development lifecycle") || q.includes("security gate") || q.includes("sast") || q.includes("dast") || q.includes("code review") || q.includes("secure code")) {
      return { answer: "Yes, a formal SDLC is in place with CODEOWNERS-enforced peer review, branch protection, Dependabot dependency scanning, and CodeQL SAST analysis in CI/CD.", confidence: 0.83 };
    }
    // Data classification
    if (q.includes("data classif") || q.includes("classification policy") || q.includes("labeling")) {
      return { answer: "A data classification scheme is documented with four tiers: Public, Internal, Confidential, and Restricted. CUI handling procedures are maintained for federal engagements. Data is labeled according to classification.", confidence: 0.77 };
    }
    // Vendor / supply chain / third-party / BAA
    if (q.includes("vendor") || q.includes("third-party") || q.includes("supply chain") || q.includes("supplier") || q.includes("baa") || q.includes("business associate")) {
      return { answer: "Third-party vendor assessments are conducted using SIG-Lite questionnaires. Critical vendors are reviewed annually. Business Associate Agreements are in place for all vendors handling ePHI. Supply chain risk management is documented.", confidence: 0.75 };
    }
    // Physical security / facilities
    if (q.includes("physical") || q.includes("facility") || q.includes("data center") || q.includes("premises")) {
      return { answer: "Operations run in cloud infrastructure (Railway/Cloudflare) with SOC 2 certified data centers. Physical security obligations are met by our cloud providers per their compliance certifications.", confidence: 0.80 };
    }
    // Risk assessment
    if (q.includes("risk assess") || q.includes("risk analysis") || q.includes("risk management") || q.includes("risk register")) {
      return { answer: "Annual formal risk assessments are performed using NIST RMF methodology. A risk register and POA&M are maintained and reviewed monthly by the Security Officer.", confidence: 0.78 };
    }
    // SSP / System Security Plan
    if (q.includes("system security plan") || q.includes("ssp")) {
      return { answer: "A System Security Plan (SSP) is documented for CUI and federal-facing systems, aligned to NIST 800-18 and FedRAMP SSP templates. Updated upon significant changes.", confidence: 0.75 };
    }
    // POA&M
    if (q.includes("poa&m") || q.includes("plan of action")) {
      return { answer: "A POA&M is maintained for all open compliance findings. It is reviewed and updated monthly by the Security Officer and reported to leadership quarterly.", confidence: 0.76 };
    }
    // Penetration testing
    if (q.includes("penetration") || q.includes("pen test") || q.includes("red team")) {
      return { answer: "Annual penetration testing is performed by a qualified third-party assessor. Findings are tracked in the POA&M and remediated within 90 days for critical/high findings.", confidence: 0.79 };
    }
    // Media / device disposal
    if (q.includes("dispos") || q.includes("sanitiz") || q.includes("media protection") || q.includes("destruction")) {
      return { answer: "Media containing sensitive data is sanitized using NIST 800-88 methods prior to disposal. Certificates of destruction are retained. Digital media on cloud is cryptographically erased.", confidence: 0.80 };
    }
    // Background checks / personnel security
    if (q.includes("background check") || q.includes("background investigation") || q.includes("screen") || q.includes("personnel security")) {
      return { answer: "Background checks are conducted for all employees and contractors prior to access. Personnel with access to CUI or federal systems undergo enhanced vetting per contract requirements.", confidence: 0.78 };
    }
    // ePHI / PHI specific
    if (q.includes("ephi") || q.includes("phi") || q.includes("protected health")) {
      return { answer: "ePHI is handled in isolated environments with strict access controls, encryption at rest and in transit, and audit logging. HIPAA safeguard requirements are applied to all ePHI systems.", confidence: 0.77 };
    }
    // PAN / cardholder data
    if (q.includes("pan") || q.includes("cardholder") || q.includes("payment card") || q.includes("cde")) {
      return { answer: "Cardholder data handling is scoped and minimized. PAN is masked in all displays. CDE is isolated per PCI DSS network segmentation requirements.", confidence: 0.76 };
    }
    return { answer: "", confidence: 0 };
  }
    }
