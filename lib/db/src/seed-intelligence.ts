import { db } from "./index";
import {
  controlFrameworkMappingsTable,
  poamItemsTable,
  complianceJourneysTable,
  remediationTasksTable,
  executiveBriefingsTable,
} from "./schema";

async function seedIntelligence() {
  console.log("Seeding intelligence data...");

  // ── Control → Framework mappings (the MOAT) ──────────────────────────────
  // UCO-001: Multi-Factor Authentication
  const mappingRows = [
    { controlId: "UCO-001", frameworkKey: "nist-800-53",  frameworkControlId: "IA-2",      frameworkControlName: "Identification and Authentication (Org. Users)", inherited: false, customerResponsibility: "full",    mappingConfidence: 0.98, mappingRationale: "MFA directly satisfies IA-2 authenticator management requirements" },
    { controlId: "UCO-001", frameworkKey: "fedramp",      frameworkControlId: "IA-2(1)",    frameworkControlName: "MFA for Privileged Accounts",                     inherited: false, customerResponsibility: "full",    mappingConfidence: 0.99, mappingRationale: "FedRAMP requires MFA for all privileged account access" },
    { controlId: "UCO-001", frameworkKey: "cmmc",         frameworkControlId: "AC.L2-3.5.3",frameworkControlName: "Multi-factor Authentication",                      inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "CMMC Level 2 mandates MFA for all user access to CUI systems" },
    { controlId: "UCO-001", frameworkKey: "soc2",         frameworkControlId: "CC6.1",      frameworkControlName: "Logical and Physical Access Controls",             inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "CC6.1 requires authentication controls preventing unauthorized access" },
    { controlId: "UCO-001", frameworkKey: "iso-27001",    frameworkControlId: "A.9.4.2",    frameworkControlName: "Secure Log-on Procedures",                        inherited: false, customerResponsibility: "full",    mappingConfidence: 0.94, mappingRationale: "ISO A.9.4.2 requires secure logon including multi-factor methods" },
    { controlId: "UCO-001", frameworkKey: "pci-dss",      frameworkControlId: "8.4",        frameworkControlName: "MFA for All Access",                              inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "PCI DSS 4.0 requires MFA for all access to CDE" },
    { controlId: "UCO-001", frameworkKey: "cis-controls", frameworkControlId: "CIS-6.3",    frameworkControlName: "Require MFA for Externally-Exposed Applications",  inherited: false, customerResponsibility: "full",    mappingConfidence: 0.93, mappingRationale: "CIS Control 6 requires MFA for all administrative access" },

    // UCO-002: Privileged Access Management
    { controlId: "UCO-002", frameworkKey: "nist-800-53",  frameworkControlId: "AC-2",       frameworkControlName: "Account Management",                              inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "AC-2 defines privileged account lifecycle management requirements" },
    { controlId: "UCO-002", frameworkKey: "fedramp",      frameworkControlId: "AC-2(1)",    frameworkControlName: "Automated System Account Management",              inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "FedRAMP requires automated management of privileged accounts" },
    { controlId: "UCO-002", frameworkKey: "cmmc",         frameworkControlId: "AC.L2-3.1.6",frameworkControlName: "Use of Privileged Accounts",                       inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "CMMC requires privileged accounts only used for privileged functions" },
    { controlId: "UCO-002", frameworkKey: "soc2",         frameworkControlId: "CC6.3",      frameworkControlName: "Role-Based Access Control",                       inherited: false, customerResponsibility: "full",    mappingConfidence: 0.94, mappingRationale: "CC6.3 requires role-based access and least privilege enforcement" },
    { controlId: "UCO-002", frameworkKey: "pci-dss",      frameworkControlId: "7.2",        frameworkControlName: "Access Control Systems and Processes",             inherited: false, customerResponsibility: "full",    mappingConfidence: 0.93, mappingRationale: "PCI DSS requires access restricted to least privilege necessary" },
    { controlId: "UCO-002", frameworkKey: "iso-27001",    frameworkControlId: "A.9.2.3",    frameworkControlName: "Management of Privileged Access Rights",           inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "ISO directly addresses privileged access rights management" },

    // UCO-003: Encryption at Rest - partially inherited from cloud provider
    { controlId: "UCO-003", frameworkKey: "fedramp",      frameworkControlId: "SC-28",      frameworkControlName: "Protection of Information at Rest",               inherited: true,  inheritedFrom: "AWS GovCloud", customerResponsibility: "partial", mappingConfidence: 0.92, mappingRationale: "AWS GovCloud provides FIPS 140-2 encryption; customer must configure key management" },
    { controlId: "UCO-003", frameworkKey: "nist-800-53",  frameworkControlId: "SC-28",      frameworkControlName: "Protection of Information at Rest",               inherited: false, customerResponsibility: "full",    mappingConfidence: 0.98, mappingRationale: "Encryption at rest directly satisfies NIST data protection requirements" },
    { controlId: "UCO-003", frameworkKey: "cmmc",         frameworkControlId: "SC.L2-3.13.16",frameworkControlName: "Protection of CUI at Rest",                    inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "CMMC requires CUI encrypted at rest on all systems" },
    { controlId: "UCO-003", frameworkKey: "pci-dss",      frameworkControlId: "3.5",        frameworkControlName: "Protect Stored Account Data",                     inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "PCI DSS requires strong encryption for stored cardholder data" },

    // UCO-004: Centralized Logging & SIEM
    { controlId: "UCO-004", frameworkKey: "nist-800-53",  frameworkControlId: "AU-2",       frameworkControlName: "Event Logging",                                   inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "Centralized SIEM satisfies audit event logging and review requirements" },
    { controlId: "UCO-004", frameworkKey: "fedramp",      frameworkControlId: "AU-2",       frameworkControlName: "Audit Events",                                    inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "FedRAMP requires audit logging of all system events" },
    { controlId: "UCO-004", frameworkKey: "soc2",         frameworkControlId: "CC7.2",      frameworkControlName: "Monitor System Components for Anomalies",         inherited: false, customerResponsibility: "full",    mappingConfidence: 0.94, mappingRationale: "CC7.2 requires monitoring for security events and anomalies" },
    { controlId: "UCO-004", frameworkKey: "pci-dss",      frameworkControlId: "10.2",       frameworkControlName: "Implement Audit Logs",                            inherited: false, customerResponsibility: "full",    mappingConfidence: 0.98, mappingRationale: "PCI DSS mandates audit logging for all system access" },
    { controlId: "UCO-004", frameworkKey: "cis-controls", frameworkControlId: "CIS-8.2",    frameworkControlName: "Collect Audit Logs",                              inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "CIS Control 8 requires centralized log collection and management" },

    // UCO-005: Vulnerability Remediation
    { controlId: "UCO-005", frameworkKey: "nist-800-53",  frameworkControlId: "RA-5",       frameworkControlName: "Vulnerability Monitoring and Scanning",           inherited: false, customerResponsibility: "full",    mappingConfidence: 0.98, mappingRationale: "RA-5 requires ongoing vulnerability scanning and remediation" },
    { controlId: "UCO-005", frameworkKey: "fedramp",      frameworkControlId: "RA-5(2)",    frameworkControlName: "Update Vulnerabilities Scanned",                  inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "FedRAMP requires continuous vulnerability scanning with defined SLAs" },
    { controlId: "UCO-005", frameworkKey: "cmmc",         frameworkControlId: "RM.L2-3.11.2",frameworkControlName: "Scan for Vulnerabilities",                       inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "CMMC requires periodic vulnerability scans and remediation tracking" },
    { controlId: "UCO-005", frameworkKey: "cis-controls", frameworkControlId: "CIS-7.4",    frameworkControlName: "Perform Automated Application Patch Management",  inherited: false, customerResponsibility: "full",    mappingConfidence: 0.93, mappingRationale: "CIS requires automated patching with tracked remediation timelines" },
    { controlId: "UCO-005", frameworkKey: "pci-dss",      frameworkControlId: "6.3",        frameworkControlName: "Security Vulnerabilities are Identified and Addressed", inherited: false, customerResponsibility: "full", mappingConfidence: 0.95, mappingRationale: "PCI DSS requires critical vulnerability remediation within one month" },

    // UCO-006 through UCO-012 - additional mappings
    { controlId: "UCO-006", frameworkKey: "nist-800-53",  frameworkControlId: "SI-3",       frameworkControlName: "Malicious Code Protection",                       inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "EDR deployment satisfies malicious code protection requirements" },
    { controlId: "UCO-006", frameworkKey: "fedramp",      frameworkControlId: "SI-3",       frameworkControlName: "Malicious Code Protection",                       inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "FedRAMP requires EDR/endpoint protection on all managed devices" },
    { controlId: "UCO-006", frameworkKey: "cmmc",         frameworkControlId: "SI.L1-3.14.2",frameworkControlName: "Malicious Code Protection",                      inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "CMMC Level 1 requires malicious code protection on endpoints" },

    { controlId: "UCO-007", frameworkKey: "nist-800-53",  frameworkControlId: "AC-17",      frameworkControlName: "Remote Access",                                   inherited: false, customerResponsibility: "full",    mappingConfidence: 0.94, mappingRationale: "Zero trust network access satisfies remote access control requirements" },
    { controlId: "UCO-007", frameworkKey: "fedramp",      frameworkControlId: "AC-17(1)",   frameworkControlName: "Automated Monitoring and Control",                 inherited: false, customerResponsibility: "full",    mappingConfidence: 0.93, mappingRationale: "FedRAMP requires automated monitoring of all remote access sessions" },

    { controlId: "UCO-008", frameworkKey: "nist-800-53",  frameworkControlId: "CP-9",       frameworkControlName: "System Backup",                                   inherited: true,  inheritedFrom: "AWS GovCloud", customerResponsibility: "partial", mappingConfidence: 0.91, mappingRationale: "AWS provides backup infrastructure; customer responsible for backup policy and testing" },
    { controlId: "UCO-008", frameworkKey: "fedramp",      frameworkControlId: "CP-9",       frameworkControlName: "System Backup",                                   inherited: true,  inheritedFrom: "AWS GovCloud", customerResponsibility: "partial", mappingConfidence: 0.90, mappingRationale: "FedRAMP backup requirements partially met by AWS managed backup service" },

    { controlId: "UCO-009", frameworkKey: "nist-800-53",  frameworkControlId: "CM-2",       frameworkControlName: "Baseline Configuration",                          inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "Container policy enforcement satisfies baseline configuration requirements" },
    { controlId: "UCO-009", frameworkKey: "cmmc",         frameworkControlId: "CM.L2-3.4.1",frameworkControlName: "Baseline Configurations",                          inherited: false, customerResponsibility: "full",    mappingConfidence: 0.94, mappingRationale: "CMMC requires documented and enforced baseline configurations" },

    { controlId: "UCO-010", frameworkKey: "nist-800-53",  frameworkControlId: "SC-7",       frameworkControlName: "Boundary Protection",                             inherited: false, customerResponsibility: "full",    mappingConfidence: 0.97, mappingRationale: "API gateway security satisfies boundary protection and filtering requirements" },
    { controlId: "UCO-010", frameworkKey: "fedramp",      frameworkControlId: "SC-7(3)",    frameworkControlName: "Access Points",                                   inherited: false, customerResponsibility: "full",    mappingConfidence: 0.96, mappingRationale: "FedRAMP requires controlled access points with policy enforcement" },
    { controlId: "UCO-010", frameworkKey: "pci-dss",      frameworkControlId: "1.3",        frameworkControlName: "Network Access Controls",                         inherited: false, customerResponsibility: "full",    mappingConfidence: 0.95, mappingRationale: "PCI DSS requires firewall and network access control at all boundaries" },

    { controlId: "UCO-011", frameworkKey: "nist-800-53",  frameworkControlId: "PE-2",       frameworkControlName: "Physical Access Authorizations",                  inherited: true,  inheritedFrom: "AWS GovCloud", customerResponsibility: "none",    mappingConfidence: 0.99, mappingRationale: "Physical security fully inherited from AWS GovCloud data center controls" },
    { controlId: "UCO-011", frameworkKey: "fedramp",      frameworkControlId: "PE-2",       frameworkControlName: "Physical Access Authorizations",                  inherited: true,  inheritedFrom: "AWS GovCloud", customerResponsibility: "none",    mappingConfidence: 0.99, mappingRationale: "FedRAMP physical controls fully inherited - AWS P-ATO covers PE family" },

    { controlId: "UCO-012", frameworkKey: "nist-800-53",  frameworkControlId: "IR-4",       frameworkControlName: "Incident Handling",                               inherited: false, customerResponsibility: "full",    mappingConfidence: 0.93, mappingRationale: "Incident response procedures satisfy IR-4 handling requirements" },
    { controlId: "UCO-012", frameworkKey: "fedramp",      frameworkControlId: "IR-4",       frameworkControlName: "Incident Handling",                               inherited: false, customerResponsibility: "full",    mappingConfidence: 0.92, mappingRationale: "FedRAMP requires documented IR procedures with defined roles" },
    { controlId: "UCO-012", frameworkKey: "soc2",         frameworkControlId: "CC7.4",      frameworkControlName: "Response to Security Incidents",                  inherited: false, customerResponsibility: "full",    mappingConfidence: 0.91, mappingRationale: "CC7.4 requires documented incident response and communication procedures" },
  ];

  await db.delete(controlFrameworkMappingsTable);
  await db.insert(controlFrameworkMappingsTable).values(mappingRows);
  console.log(`  ✓ Seeded ${mappingRows.length} control-framework mappings`);

  // ── POA&M Items ──────────────────────────────────────────────────────────
  const futureDate = (days: number) => new Date(Date.now() + days * 86400000);

  await db.delete(poamItemsTable);
  await db.insert(poamItemsTable).values([
    {
      frameworkKey: "fedramp", controlId: "UCO-005",
      title: "Vulnerability Remediation SLA Non-Compliance",
      weakness: "Critical vulnerabilities not remediated within 30-day FedRAMP requirement",
      description: "CVE-2024-47892 on legacy-erp-server has remained open for 31 days, exceeding the FedRAMP-mandated 30-day remediation SLA for critical vulnerabilities. Compensating control in place but insufficient.",
      severity: "critical", status: "open",
      ownerName: "Sarah Chen", ownerTeam: "Platform Engineering",
      scheduledCompletionDate: futureDate(14),
      milestones: ["Patch testing complete by Day 3", "Staged deployment by Day 7", "Production deployment by Day 14", "Verification scan by Day 16"],
      originalRisk: "critical", residualRisk: "low",
      resources: "Platform Engineering team + Tenable scanner", estimatedCost: 45000,
    },
    {
      frameworkKey: "fedramp", controlId: "UCO-002",
      title: "Privileged Account Management Gap - Service Accounts",
      weakness: "Service accounts with excessive privileges not reviewed on required 90-day cycle",
      description: "svc-account-prod-admin holds Domain Admin rights and has not undergone quarterly access review. Violates FedRAMP AC-2 account management requirements.",
      severity: "high", status: "on_track",
      ownerName: "Marcus Johnson", ownerTeam: "IAM Team",
      scheduledCompletionDate: futureDate(21),
      milestones: ["Access review initiated", "Least-privilege analysis complete by Day 7", "Rights reduction implemented by Day 14", "Review cycle automated by Day 21"],
      originalRisk: "high", residualRisk: "low",
      resources: "IAM Team + CyberArk PAM", estimatedCost: 12000,
    },
    {
      frameworkKey: "fedramp", controlId: "UCO-004",
      title: "Audit Log Retention Below FedRAMP Requirement",
      weakness: "Current log retention period is 60 days; FedRAMP requires minimum 90 days online, 3 years archive",
      description: "Sentinel SIEM retention policy set to 60 days for hot storage. FedRAMP AU-11 requires 90 days online retention and 3-year archive. Gap identified during internal audit.",
      severity: "medium", status: "open",
      ownerName: "Priya Patel", ownerTeam: "Security Operations",
      scheduledCompletionDate: futureDate(30),
      milestones: ["Current state documented", "Cost analysis for extended retention by Day 5", "Retention policy updated by Day 15", "Archive pipeline configured by Day 30"],
      originalRisk: "medium", residualRisk: "low",
      resources: "SOC Team + Microsoft Sentinel", estimatedCost: 8500,
    },
    {
      frameworkKey: "cmmc", controlId: "UCO-005",
      title: "Vulnerability Scanning Frequency Below CMMC Requirement",
      weakness: "Current scanning cadence is monthly; CMMC Level 2 requires periodic scans with risk-based frequency",
      description: "Tenable scanner currently runs monthly sweeps. CMMC RM.L2-3.11.2 interpretation requires at minimum bi-weekly scanning for systems handling CUI.",
      severity: "medium", status: "open",
      ownerName: "David Kim", ownerTeam: "Vulnerability Management",
      scheduledCompletionDate: futureDate(45),
      milestones: ["Scanning policy reviewed", "Tenable scheduling updated by Day 10", "CUI system scan group configured by Day 20", "First bi-weekly report generated by Day 30"],
      originalRisk: "medium", residualRisk: "low",
      resources: "Vulnerability Management team + Tenable.io", estimatedCost: 5000,
    },
    {
      frameworkKey: "nist-800-53", controlId: "UCO-007",
      title: "Remote Access Monitoring Gap",
      weakness: "Remote access sessions not fully logged and monitored per AC-17 requirements",
      description: "VPN and remote access sessions are logged but not correlated with user identity and session behavior. NIST AC-17(1) requires automated monitoring of remote access sessions.",
      severity: "medium", status: "delayed",
      ownerName: "James Rivera", ownerTeam: "Network Security",
      scheduledCompletionDate: futureDate(60),
      milestones: ["Gap assessment complete", "SIEM correlation rules designed by Day 15", "Rules deployed and tested by Day 40", "Automated alerting validated by Day 60"],
      originalRisk: "medium", residualRisk: "low",
      resources: "Network Security + Sentinel SIEM", estimatedCost: 18000,
    },
  ]);
  console.log("  ✓ Seeded 5 POA&M items");

  // ── Compliance Journeys ───────────────────────────────────────────────────
  await db.delete(remediationTasksTable);
  await db.delete(complianceJourneysTable);

  const [fedrampJourney] = await db.insert(complianceJourneysTable).values({
    frameworkKey: "fedramp",
    targetLevel: "moderate",
    phase: "validation",
    systemName: "Acme Federal Cloud Platform",
    systemDescription: "Multi-tenant SaaS platform processing CUI for federal agency customers. Hosted on AWS GovCloud (US-East).",
    systemType: "saas",
    dataClassification: "cui",
    boundaryDescription: "AWS GovCloud VPC encompassing API gateway, microservices cluster, PostgreSQL RDS, and S3 buckets. Excludes corporate IT systems.",
    leveragedAto: "AWS GovCloud (FedRAMP High P-ATO)",
    targetAtoDate: new Date("2026-09-01"),
    startedAt: new Date("2025-11-01"),
  }).returning();

  const [cmmc2Journey] = await db.insert(complianceJourneysTable).values({
    frameworkKey: "cmmc",
    targetLevel: "level2",
    phase: "gap",
    systemName: "Acme Defense Contractor Platform",
    systemDescription: "Internal systems handling Controlled Unclassified Information (CUI) for DoD contracts. Primarily on-premise with Azure Government integration.",
    systemType: "hybrid",
    dataClassification: "cui",
    boundaryDescription: "On-premise data center plus Azure Government tenant. Includes engineering workstations, development systems, and collaboration tools.",
    leveragedAto: null,
    targetAtoDate: new Date("2026-12-01"),
    startedAt: new Date("2026-03-01"),
  }).returning();

  console.log("  ✓ Seeded 2 compliance journeys");

  // ── Remediation Tasks ─────────────────────────────────────────────────────
  await db.insert(remediationTasksTable).values([
    // FedRAMP journey tasks
    { journeyId: fedrampJourney.id, controlId: "UCO-005", frameworkKey: "fedramp", title: "Remediate CVE-2024-47892 on legacy-erp-server", description: "Critical RCE vulnerability must be patched within 30-day SLA. Coordinate with Platform Engineering for emergency change.", effort: "high", priority: 1, estimatedDays: 14, assignee: "Sarah Chen", team: "Platform Engineering", status: "in_progress", dueDate: futureDate(14) },
    { journeyId: fedrampJourney.id, controlId: "UCO-002", frameworkKey: "fedramp", title: "Implement quarterly privileged account reviews", description: "Automate quarterly access reviews for all privileged accounts using CyberArk workflow. Eliminate manual review gaps.", effort: "medium", priority: 2, estimatedDays: 21, assignee: "Marcus Johnson", team: "IAM Team", status: "in_progress", dueDate: futureDate(21) },
    { journeyId: fedrampJourney.id, controlId: "UCO-004", frameworkKey: "fedramp", title: "Extend log retention to 90-day minimum", description: "Update Sentinel retention policy and configure archive to Azure Blob Storage for 3-year retention compliance.", effort: "low", priority: 3, estimatedDays: 10, assignee: "Priya Patel", team: "SOC", status: "not_started", dueDate: futureDate(10) },
    { journeyId: fedrampJourney.id, controlId: "UCO-001", frameworkKey: "fedramp", title: "Enforce MFA for all break-glass accounts", description: "Ensure emergency break-glass accounts have MFA with hardware tokens per FedRAMP IA-2(1) requirements.", effort: "low", priority: 4, estimatedDays: 5, assignee: "Marcus Johnson", team: "IAM Team", status: "complete", dueDate: futureDate(-10), completedAt: new Date(Date.now() - 10 * 86400000) },
    { journeyId: fedrampJourney.id, controlId: "UCO-007", frameworkKey: "fedramp", title: "Implement automated remote access session monitoring", description: "Deploy Sentinel correlation rules for remote access anomaly detection per AC-17(1).", effort: "medium", priority: 5, estimatedDays: 30, assignee: "James Rivera", team: "Network Security", status: "not_started", dueDate: futureDate(30) },
    { journeyId: fedrampJourney.id, controlId: "UCO-003", frameworkKey: "fedramp", title: "Document customer key management responsibilities", description: "Create SSP narrative for SC-28 clarifying shared responsibility with AWS KMS and customer-managed CMKs.", effort: "low", priority: 6, estimatedDays: 7, assignee: "Jennifer Walsh", team: "GRC", status: "complete", dueDate: futureDate(-5), completedAt: new Date(Date.now() - 5 * 86400000) },
    { journeyId: fedrampJourney.id, controlId: "UCO-008", frameworkKey: "fedramp", title: "Test backup restoration procedures", description: "Conduct and document full backup restoration test per CP-9 and CP-10 requirements.", effort: "medium", priority: 7, estimatedDays: 14, assignee: "David Kim", team: "Platform Engineering", status: "not_started", dueDate: futureDate(45) },

    // CMMC journey tasks
    { journeyId: cmmc2Journey.id, controlId: "UCO-005", frameworkKey: "cmmc", title: "Increase vulnerability scan frequency to bi-weekly", description: "Configure Tenable to scan CUI-handling systems bi-weekly. Document scanning policy and remediation SLAs.", effort: "low", priority: 1, estimatedDays: 10, assignee: "David Kim", team: "Vulnerability Management", status: "not_started", dueDate: futureDate(45) },
    { journeyId: cmmc2Journey.id, controlId: "UCO-002", frameworkKey: "cmmc", title: "Deploy CyberArk PAM for all CUI-system accounts", description: "Extend PAM coverage to all systems in CMMC boundary. Document all privileged account workflows.", effort: "high", priority: 2, estimatedDays: 45, assignee: "Marcus Johnson", team: "IAM Team", status: "not_started", dueDate: futureDate(90) },
    { journeyId: cmmc2Journey.id, controlId: "UCO-001", frameworkKey: "cmmc", title: "Enable MFA for all CUI system access", description: "Ensure all user access to CUI systems requires MFA. Document exceptions with compensating controls.", effort: "medium", priority: 3, estimatedDays: 14, assignee: "Marcus Johnson", team: "IAM Team", status: "in_progress", dueDate: futureDate(14) },
    { journeyId: cmmc2Journey.id, controlId: "UCO-009", frameworkKey: "cmmc", title: "Define and enforce baseline configurations", description: "Create STIGs-aligned baseline configs for all CUI system types. Implement automated compliance checking.", effort: "high", priority: 4, estimatedDays: 60, assignee: "Sarah Chen", team: "Platform Engineering", status: "not_started", dueDate: futureDate(120) },
    { journeyId: cmmc2Journey.id, controlId: "UCO-006", frameworkKey: "cmmc", title: "Deploy EDR to all endpoints in CMMC boundary", description: "Extend CrowdStrike coverage to all engineering workstations and servers handling CUI.", effort: "medium", priority: 5, estimatedDays: 21, assignee: "James Rivera", team: "Endpoint Security", status: "not_started", dueDate: futureDate(60) },
  ]);
  console.log("  ✓ Seeded 12 remediation tasks");

  // ── Executive Briefing (initial) ──────────────────────────────────────────
  await db.insert(executiveBriefingsTable).values({
    headline: "Cyber posture at-risk at 54/100 - 2 critical findings open, estimated exposure $1.4M–$8.6M",
    postureDelta: "1 control failed validation this cycle (UCO-005 Vulnerability Remediation SLA), dragging posture below 60-point target. Root cause: CVE-2024-47892 exceeded 30-day remediation SLA on legacy-erp-server.",
    situationSummary: "3 active critical threat vectors identified. FedRAMP and NIST 800-53 compliance below 75% threshold requiring attention before Q3 audit window. 2 findings breached remediation SLA - direct engineering leadership escalation required.",
    financialExposureLow: 1_400_000,
    financialExposureHigh: 8_600_000,
    topThreatsJson: JSON.stringify([
      { title: "Privilege Escalation via Misconfigured Service Account", severity: "critical", context: "Exploitability 87% - Privilege Escalation, Lateral Movement" },
      { title: "Unpatched Critical CVE in Legacy ERP Server", severity: "critical", context: "Exploitability 92% - Remote Code Execution, Lateral Movement" },
      { title: "Internet-Exposed API Gateway Without WAF", severity: "critical", context: "Exploitability 78% - API Abuse, Injection" },
    ]),
    recommendedActionsJson: JSON.stringify([
      "Resolve 2 critical open findings before next board review",
      "2 findings breached SLA - escalate to engineering leadership immediately",
      "FedRAMP and NIST 800-53 compliance below 75% - review control gaps",
      "1 failed control requires immediate remediation (UCO-005)",
    ]),
    frameworksAtRiskJson: JSON.stringify(["FedRAMP", "NIST 800-53"]),
    confidenceScore: 0.88,
    dataFreshnessScore: 0.92,
    generatedAt: new Date(),
  });
  console.log("  ✓ Seeded executive briefing");

  console.log("Intelligence seed complete.");
}

seedIntelligence()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
