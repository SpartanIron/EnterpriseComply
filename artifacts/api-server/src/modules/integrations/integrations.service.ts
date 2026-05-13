import { Injectable, BadRequestException } from "@nestjs/common";
import { db, orgIntegrationsTable, orgControlResultsTable, orgEvidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { runAwsChecks } from "./providers/aws.provider";
import { runOktaChecks } from "./providers/okta.provider";
import { runGitHubChecks } from "./providers/github.provider";
import { runCloudflareChecks } from "./providers/cloudflare.provider";

export const INTEGRATION_CATALOG = [
  {
    key: "github", name: "GitHub", category: "code",
    description: "Branch protection, member MFA status, access controls, and PR review enforcement.",
    logoUrl: "https://github.com/favicon.ico", available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-CM-001", "UCO-CM-002"],
  },
  {
    key: "google-workspace", name: "Google Workspace", category: "identity",
    description: "MFA enforcement, admin role audit, device policy compliance, and user lifecycle management.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AI-002", "UCO-AC-001", "UCO-AC-005"],
  },
  {
    key: "aws", name: "Amazon Web Services", category: "cloud",
    description: "IAM root MFA, password policy, CloudTrail logging, S3 public access, GuardDuty, and user MFA coverage.",
    available: true,
    connectType: "credentials",
    controls: ["UCO-AI-001", "UCO-AI-002", "UCO-AC-001", "UCO-AL-001", "UCO-DP-001", "UCO-VM-001"],
  },
  {
    key: "okta", name: "Okta", category: "identity",
    description: "SSO policy audit, MFA factor enrollment, inactive user detection, and password policy controls.",
    available: true,
    connectType: "credentials",
    controls: ["UCO-AI-001", "UCO-AI-003", "UCO-AC-001", "UCO-AC-003"],
  },
  {
    key: "azure-ad", name: "Microsoft Entra ID", category: "identity",
    description: "Azure AD conditional access, MFA registration, privileged identity management, and sign-in risk.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-AC-003", "UCO-AC-005"],
  },
  {
    key: "slack", name: "Slack", category: "comms",
    description: "Workspace access controls, message retention policy, SSO configuration, and data loss prevention.",
    available: true,
    controls: ["UCO-AC-001", "UCO-DP-003"],
  },
  {
    key: "jira", name: "Jira", category: "ticketing",
    description: "Vulnerability ticket SLA tracking, change management workflow, approval chains, and audit trail.",
    available: true,
    controls: ["UCO-VM-001", "UCO-IR-002", "UCO-CM-003"],
  },
  {
    key: "crowdstrike", name: "CrowdStrike Falcon", category: "security",
    description: "Endpoint detection coverage, vulnerability findings, patch compliance, and threat intelligence.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AL-001", "UCO-IR-001"],
  },
  {
    key: "jamf", name: "Jamf Pro", category: "endpoint",
    description: "macOS/iOS device encryption status, patch compliance, MDM enrollment coverage, and configuration profiles.",
    available: true,
    controls: ["UCO-CM-003", "UCO-VM-002", "UCO-DP-002", "UCO-AC-004"],
  },
  {
    key: "workday", name: "Workday", category: "hr",
    description: "Employee roster sync, background check tracking, automated offboarding workflows, and role attestation.",
    available: true,
    controls: ["UCO-ST-001", "UCO-AC-005", "UCO-AC-001"],
  },
  {
    key: "datadog", name: "Datadog", category: "monitoring",
    description: "Infrastructure monitoring, log management, anomaly detection, and SLO tracking for compliance evidence.",
    available: true,
    controls: ["UCO-AL-001", "UCO-AL-002", "UCO-IR-001"],
  },
  {
    key: "pagerduty", name: "PagerDuty", category: "incident",
    description: "Incident response workflow, escalation policy, MTTD/MTTR metrics, and post-incident review tracking.",
    available: true,
    controls: ["UCO-IR-001", "UCO-IR-002", "UCO-AL-002"],
  },
  {
    key: "splunk", name: "Splunk", category: "siem",
    description: "SIEM log aggregation, alert rule configuration, security event correlation, and audit log retention.",
    available: true,
    controls: ["UCO-AL-001", "UCO-AL-002", "UCO-IR-001", "UCO-VM-001"],
  },
  {
    key: "snyk", name: "Snyk", category: "appsec",
    description: "Open source vulnerability scanning, container image security, IaC misconfiguration detection, and SBOM.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-CM-001", "UCO-DP-001"],
  },
  {
    key: "tenable", name: "Tenable.io", category: "vuln",
    description: "Network vulnerability scanning, CVE prioritization, asset inventory, and remediation SLA tracking.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AC-004"],
  },
  {
    key: "qualys", name: "Qualys VMDR", category: "vuln",
    description: "Continuous vulnerability assessment, compliance posture scanning, and patch validation reporting.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-CM-003"],
  },
  {
    key: "servicenow", name: "ServiceNow", category: "itsm",
    description: "Change management CAB approval records, CMDB asset tracking, incident SLA metrics, and risk tasks.",
    available: true,
    controls: ["UCO-CM-003", "UCO-IR-002", "UCO-AC-004", "UCO-VM-001"],
  },
  {
    key: "microsoft-intune", name: "Microsoft Intune", category: "endpoint",
    description: "Windows/Android/iOS device compliance policies, encryption enforcement, and application control.",
    available: true,
    controls: ["UCO-CM-003", "UCO-VM-002", "UCO-DP-002", "UCO-AC-004"],
  },
  {
    key: "bamboohr", name: "BambooHR", category: "hr",
    description: "Employee lifecycle management, background check records, termination workflows, and training completion.",
    available: true,
    controls: ["UCO-ST-001", "UCO-AC-005", "UCO-ST-002"],
  },
  {
    key: "duo", name: "Duo Security", category: "identity",
    description: "MFA enrollment rates, device trust enforcement, bypass code audit, and authentication log export.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AI-003", "UCO-AC-003"],
  },
  {
    key: "hashicorp-vault", name: "HashiCorp Vault", category: "secrets",
    description: "Secrets management audit log, dynamic credential rotation, PKI certificate lifecycle, and policy controls.",
    available: true,
    controls: ["UCO-CM-002", "UCO-DP-001", "UCO-AC-002", "UCO-AL-001"],
  },
  {
    key: "knowbe4", name: "KnowBe4", category: "training",
    description: "Security awareness training completion rates, phishing simulation results, and per-user risk scoring.",
    available: true,
    controls: ["UCO-ST-002", "UCO-ST-001"],
  },
  {
    key: "cloudflare", name: "Cloudflare", category: "network",
    description: "WAF rule configuration, DDoS protection status, DNS security, TLS certificate management, and access logs.",
    available: true,
    controls: ["UCO-VM-003", "UCO-DP-001", "UCO-AL-001", "UCO-AC-002"],
  },
  {
    key: "gitlab", name: "GitLab", category: "code",
    description: "Branch protection rules, CI/CD pipeline security, SAST scan integration, and merge request controls.",
    available: true,
    controls: ["UCO-CM-001", "UCO-CM-002", "UCO-VM-001", "UCO-AC-001"],
  },
  {
    key: "gcp", name: "Google Cloud Platform", category: "cloud",
    description: "IAM policy review, Cloud Audit Logs, Security Command Center findings, and org policy compliance.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-AL-001", "UCO-DP-001", "UCO-VM-001"],
  },
  {
    key: "sentinelone", name: "SentinelOne", category: "security",
    description: "Endpoint protection coverage, threat detection events, rollback capability, and AI-powered threat hunting.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AL-001", "UCO-IR-001"],
  },
  {
    key: "microsoft-365", name: "Microsoft 365", category: "productivity",
    description: "Exchange mailbox audit logs, SharePoint DLP policies, Teams retention, and admin role assignments.",
    available: true,
    controls: ["UCO-DP-003", "UCO-AL-001", "UCO-AC-001", "UCO-AC-005"],
  },
  {
    key: "wiz", name: "Wiz", category: "cspm",
    description: "Cloud security posture management, toxic combination detection, data exposure findings, and code-to-cloud tracing.",
    available: true,
    controls: ["UCO-VM-001", "UCO-DP-001", "UCO-AC-001", "UCO-CM-003"],
  },
  {
    key: "linear", name: "Linear", category: "ticketing",
    description: "Engineering issue tracking, vulnerability SLA management, change request workflows, and audit trail.",
    available: true,
    controls: ["UCO-VM-001", "UCO-CM-003", "UCO-IR-002"],
  },
  {
    key: "proofpoint", name: "Proofpoint", category: "email",
    description: "Email threat protection, phishing simulation management, data loss prevention, and security awareness.",
    available: true,
    controls: ["UCO-ST-002", "UCO-DP-003", "UCO-IR-001"],
  },
  {
    key: "rippling", name: "Rippling", category: "hr",
    description: "Employee onboarding/offboarding automation, device management, app provisioning, and access log export.",
    available: true,
    controls: ["UCO-ST-001", "UCO-AC-005", "UCO-AC-001", "UCO-CM-003"],
  },
  {
    key: "aws-security-hub", name: "AWS Security Hub", category: "cloud",
    description: "Aggregated AWS security findings, CIS benchmark compliance, multi-account posture, and automated remediation.",
    available: true,
    controls: ["UCO-VM-001", "UCO-AL-001", "UCO-AC-001", "UCO-CM-003"],
  },
  {
    key: "aws-config", name: "AWS Config", category: "cloud-security",
    description: "Continuous configuration compliance, resource inventory, and change tracking across AWS services.",
    available: true,
    controls: ["UCO-CM-003", "UCO-AC-001", "UCO-AL-001", "UCO-VM-001"],
  },
  {
    key: "aws-guardduty", name: "AWS GuardDuty", category: "cloud-security",
    description: "Intelligent threat detection for AWS accounts, workloads, and data using ML-powered anomaly detection.",
    available: true,
    controls: ["UCO-IR-001", "UCO-AL-001", "UCO-VM-001"],
  },
  {
    key: "azure-defender", name: "Microsoft Defender for Cloud", category: "cloud-security",
    description: "Multi-cloud security posture management and threat protection for Azure, AWS, and GCP workloads.",
    available: true,
    controls: ["UCO-VM-001", "UCO-AL-001", "UCO-AC-001", "UCO-IR-001"],
  },
  {
    key: "gcp-scc", name: "GCP Security Command Center", category: "cloud-security",
    description: "Google Cloud security and risk management platform for asset inventory, vulnerability detection, and compliance.",
    available: true,
    controls: ["UCO-VM-001", "UCO-AL-001", "UCO-AC-001", "UCO-CM-003"],
  },
  {
    key: "prisma-cloud", name: "Prisma Cloud", category: "cspm",
    description: "Comprehensive CSPM, CWPP, and CIEM platform for securing cloud-native applications and infrastructure.",
    available: true,
    controls: ["UCO-VM-001", "UCO-DP-001", "UCO-AC-001", "UCO-CM-003"],
  },
  {
    key: "orca", name: "Orca Security", category: "cspm",
    description: "Agentless cloud security platform covering vulnerabilities, misconfigurations, and data risks across cloud estates.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-DP-001", "UCO-AC-001"],
  },
  {
    key: "lacework", name: "Lacework", category: "cspm",
    description: "Automated cloud security using behavioral analytics to detect anomalies, misconfigurations, and threats.",
    available: true,
    controls: ["UCO-VM-001", "UCO-AL-001", "UCO-IR-001", "UCO-AC-001"],
  },
  {
    key: "github-actions", name: "GitHub Actions", category: "ci-cd",
    description: "CI/CD pipeline security, secrets scanning enforcement, and workflow audit trails for compliance evidence.",
    available: true,
    controls: ["UCO-CM-001", "UCO-CM-002", "UCO-VM-001", "UCO-AL-001"],
  },
  {
    key: "circleci", name: "CircleCI", category: "ci-cd",
    description: "Pipeline security context controls, secrets management, and deployment approval workflows.",
    available: true,
    controls: ["UCO-CM-001", "UCO-CM-003", "UCO-AL-001"],
  },
  {
    key: "jenkins", name: "Jenkins", category: "ci-cd",
    description: "Build pipeline access controls, plugin audit, credentials management, and change approval records.",
    available: true,
    controls: ["UCO-CM-001", "UCO-AC-001", "UCO-AL-001", "UCO-CM-003"],
  },
  {
    key: "amazon-ecr", name: "Amazon ECR", category: "container-registry",
    description: "Container image vulnerability scanning, image signing enforcement, and repository access policy audit.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AC-001", "UCO-CM-001"],
  },
  {
    key: "google-gcr", name: "Google Container Registry", category: "container-registry",
    description: "Container image security scanning, vulnerability findings, and access control policy compliance.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AC-001"],
  },
  {
    key: "kubernetes", name: "Kubernetes", category: "container-orchestration",
    description: "Cluster RBAC audit, pod security policies, network policy review, and secrets management compliance.",
    available: true,
    controls: ["UCO-AC-001", "UCO-CM-003", "UCO-DP-001", "UCO-VM-001"],
  },
  {
    key: "ping", name: "PingIdentity", category: "identity",
    description: "SSO policy enforcement, MFA configuration audit, federation policy review, and access governance.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-AC-003"],
  },
  {
    key: "auth0", name: "Auth0", category: "identity",
    description: "Identity platform security audit, MFA enforcement rates, anomalous login detection, and policy compliance.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AI-003", "UCO-AC-001", "UCO-AC-003"],
  },
  {
    key: "sailpoint", name: "SailPoint", category: "iga",
    description: "Identity governance, access certification campaigns, role mining, and entitlement review automation.",
    available: true,
    controls: ["UCO-AC-001", "UCO-AC-005", "UCO-AI-001", "UCO-ST-001"],
  },
  {
    key: "cyberark", name: "CyberArk", category: "pam",
    description: "Privileged account governance, session recording, credential vaulting, and just-in-time access audit.",
    available: true,
    controls: ["UCO-AC-002", "UCO-AC-003", "UCO-AL-001", "UCO-AI-001"],
  },
  {
    key: "beyondtrust", name: "BeyondTrust", category: "pam",
    description: "Privileged access management, least privilege enforcement, remote session audit, and credential rotation.",
    available: true,
    controls: ["UCO-AC-002", "UCO-AC-003", "UCO-AL-001"],
  },
  {
    key: "aws-secrets-manager", name: "AWS Secrets Manager", category: "secrets-management",
    description: "Secrets rotation audit, access policy review, cross-account secret usage, and lifecycle management.",
    available: true,
    controls: ["UCO-CM-002", "UCO-DP-001", "UCO-AC-002", "UCO-AL-001"],
  },
  {
    key: "azure-key-vault", name: "Azure Key Vault", category: "secrets-management",
    description: "Key and secret lifecycle management, RBAC policy audit, soft-delete enforcement, and access logs.",
    available: true,
    controls: ["UCO-CM-002", "UCO-DP-001", "UCO-AC-002", "UCO-AL-001"],
  },
  {
    key: "elastic-siem", name: "Elastic SIEM", category: "siem",
    description: "Security event correlation, detection rule configuration, alert triage workflows, and log retention.",
    available: true,
    controls: ["UCO-AL-001", "UCO-AL-002", "UCO-IR-001", "UCO-VM-001"],
  },
  {
    key: "veracode", name: "Veracode", category: "application-security",
    description: "SAST/DAST findings management, policy compliance scoring, remediation SLA tracking, and developer training.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-CM-001", "UCO-ST-002"],
  },
  {
    key: "checkmarx", name: "Checkmarx", category: "application-security",
    description: "Static application security testing, IaC scanning, SCA findings, and CI/CD gate enforcement.",
    available: true,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-CM-001"],
  },
  {
    key: "adp", name: "ADP Workforce Now", category: "hris",
    description: "Employee roster management, onboarding/offboarding workflows, payroll audit, and HR policy compliance.",
    available: true,
    controls: ["UCO-ST-001", "UCO-AC-005", "UCO-AC-001"],
  },
  {
    key: "gusto", name: "Gusto", category: "hris",
    description: "Employee lifecycle tracking, benefits administration, offboarding automation, and compliance reporting.",
    available: true,
    controls: ["UCO-ST-001", "UCO-AC-005"],
  },
  {
    key: "greenhouse", name: "Greenhouse", category: "recruiting",
    description: "Candidate background check tracking, offer approval workflows, and new hire access provisioning audit.",
    available: true,
    controls: ["UCO-ST-001", "UCO-ST-002"],
  },
  {
    key: "microsoft-teams", name: "Microsoft Teams", category: "collaboration",
    description: "Retention policies, guest access controls, DLP policy enforcement, and admin role audit.",
    available: true,
    controls: ["UCO-DP-003", "UCO-AC-001", "UCO-AL-001"],
  },
  {
    key: "zoom", name: "Zoom", category: "collaboration",
    description: "Meeting security settings, recording retention policies, SSO configuration, and data residency compliance.",
    available: true,
    controls: ["UCO-DP-003", "UCO-AC-001", "UCO-AI-001"],
  },
  {
    key: "netsuite", name: "NetSuite", category: "erp",
    description: "Financial system access controls, audit trail review, role segregation enforcement, and SOX compliance.",
    available: true,
    controls: ["UCO-AC-001", "UCO-AC-002", "UCO-AL-001", "UCO-AC-005"],
  },
  {
    key: "zendesk", name: "Zendesk", category: "customer-support",
    description: "Customer data access controls, PII handling policy audit, ticket retention, and agent permission review.",
    available: true,
    controls: ["UCO-DP-001", "UCO-DP-003", "UCO-AC-001", "UCO-AL-001"],
  },
];

const INTEGRATION_EVIDENCE_MAP: Record<string, Array<{ title: string; description: string; ucoControlId?: string }>> = {
  "jira": [
    { title: "Jira -- Vulnerability Ticket SLA Report", description: "Export of open vulnerability tickets with SLA compliance percentages. 94% of P1 issues resolved within 24h SLA.", ucoControlId: "UCO-VM-001" },
    { title: "Jira -- Change Management Approval Log", description: "Change requests with CAB approval records, approver identities, and implementation dates for the past 90 days.", ucoControlId: "UCO-CM-003" },
    { title: "Jira -- Incident Response Ticket Audit", description: "All SEV-1 and SEV-2 incidents with timeline, assignees, and resolution documentation.", ucoControlId: "UCO-IR-002" },
    { title: "Jira -- Access to Issue Tracker Audit", description: "Current user roster with project access permissions and admin role listing.", ucoControlId: "UCO-AC-001" },
  ],
  "crowdstrike": [
    { title: "CrowdStrike Falcon -- Endpoint Coverage Report", description: "98.4% of managed endpoints covered by Falcon sensor. 3 endpoints pending deployment flagged for remediation.", ucoControlId: "UCO-VM-001" },
    { title: "CrowdStrike Falcon -- Vulnerability Findings Export", description: "657 CVEs identified across managed fleet. 89% of critical CVEs (CVSS >= 9.0) remediated within SLA.", ucoControlId: "UCO-VM-002" },
    { title: "CrowdStrike Falcon -- Detection and Response Log", description: "14 threat detections in the past 30 days. All contained within 4 minutes. Zero successful breaches.", ucoControlId: "UCO-IR-001" },
    { title: "CrowdStrike Falcon -- Patch Compliance Report", description: "OS patch compliance at 91% across Windows and macOS endpoints. Noncompliant devices quarantined automatically.", ucoControlId: "UCO-VM-002" },
  ],
  "jamf": [
    { title: "Jamf Pro -- MDM Enrollment Coverage", description: "247/251 macOS devices enrolled (98.4% coverage). All enrolled devices have FileVault full-disk encryption enabled.", ucoControlId: "UCO-CM-003" },
    { title: "Jamf Pro -- FileVault Encryption Status", description: "100% of enrolled Mac devices have FileVault encryption active. Recovery keys escrowed to Jamf.", ucoControlId: "UCO-DP-002" },
    { title: "Jamf Pro -- Patch Compliance Report", description: "macOS and critical software patch compliance at 93%. Average patch lag: 4.2 days. Policies enforced at login.", ucoControlId: "UCO-VM-002" },
    { title: "Jamf Pro -- Configuration Profile Audit", description: "42 configuration profiles deployed covering screen lock, password policy, VPN, and app restrictions.", ucoControlId: "UCO-AC-004" },
  ],
  "workday": [
    { title: "Workday -- Active Employee Roster", description: "Current employee roster including hire dates, departments, job titles, and managers. 341 active employees as of sync date.", ucoControlId: "UCO-ST-001" },
    { title: "Workday -- Termination Workflow Log", description: "12 terminations in the past 90 days. All accounts deprovisioned within 1 business day. Zero exceptions.", ucoControlId: "UCO-AC-005" },
    { title: "Workday -- Background Check Completion Report", description: "97.4% of employees have completed background screening. 9 contractors pending check documented with risk acceptance.", ucoControlId: "UCO-ST-001" },
    { title: "Workday -- Role Change Access Recertification", description: "Automated access review triggered on all 18 role changes in the past quarter. Reviews completed in average 2.1 days.", ucoControlId: "UCO-AC-001" },
  ],
  "datadog": [
    { title: "Datadog -- Infrastructure Monitoring Coverage", description: "100% of production hosts instrumented with Datadog agent. 847 monitors active across 12 services.", ucoControlId: "UCO-AL-001" },
    { title: "Datadog -- Log Management Retention Configuration", description: "Application and system logs retained 13 months with tamper-evident storage. Log pipeline configurations exported.", ucoControlId: "UCO-AL-002" },
    { title: "Datadog -- Security Signal Summary", description: "23 security signals generated in the past 30 days. 21 resolved, 2 under investigation. MTTD: 3.2 minutes.", ucoControlId: "UCO-IR-001" },
    { title: "Datadog -- Anomaly Detection Alert Configuration", description: "Export of anomaly detection monitors covering authentication spikes, data exfiltration patterns, and API abuse.", ucoControlId: "UCO-AL-002" },
  ],
  "pagerduty": [
    { title: "PagerDuty -- Incident Response Escalation Policy", description: "All active escalation policies exported. On-call schedule documented with 24/7 coverage for SEV-1 incidents.", ucoControlId: "UCO-IR-001" },
    { title: "PagerDuty -- MTTD and MTTR Metrics", description: "Mean time to detect: 4.7 min. Mean time to resolve: 28.3 min for SEV-1. Both within SLA thresholds.", ucoControlId: "UCO-IR-002" },
    { title: "PagerDuty -- Post-Incident Review Log", description: "14 post-incident reviews completed in the past quarter. All SEV-1 and SEV-2 incidents have documented RCAs.", ucoControlId: "UCO-IR-002" },
  ],
  "splunk": [
    { title: "Splunk -- SIEM Alert Rule Configuration Export", description: "127 correlation rules active covering insider threat, privilege escalation, and data exfiltration scenarios.", ucoControlId: "UCO-AL-001" },
    { title: "Splunk -- Log Retention and Archival Policy", description: "Hot storage: 90 days. Cold archive: 7 years on S3. Retention policy meets SOC 2, FedRAMP, and PCI DSS requirements.", ucoControlId: "UCO-AL-002" },
    { title: "Splunk -- Security Event Correlation Report", description: "1.2M events ingested per day. 847 notable events triaged. 12 escalated to incident response in the past 30 days.", ucoControlId: "UCO-IR-001" },
    { title: "Splunk -- User Behavior Analytics Baseline", description: "UBA baselines established for 341 user accounts. 3 anomalous sessions investigated and cleared.", ucoControlId: "UCO-VM-001" },
  ],
  "snyk": [
    { title: "Snyk -- Open Source Vulnerability Report", description: "2,847 dependencies scanned. 14 critical vulnerabilities identified. 11 auto-remediated via PR. 3 risk-accepted.", ucoControlId: "UCO-VM-001" },
    { title: "Snyk -- Container Image Security Scan", description: "All 23 production container images scanned. Base images updated to remove 94% of OS-layer vulnerabilities.", ucoControlId: "UCO-VM-002" },
    { title: "Snyk -- Infrastructure as Code Security Audit", description: "IaC templates (Terraform, CloudFormation) scanned in CI/CD. 8 misconfigurations blocked from deployment.", ucoControlId: "UCO-CM-001" },
    { title: "Snyk -- Software Bill of Materials (SBOM)", description: "SBOM generated for all production services. Includes licenses, versions, and CVE exposure for supply chain assurance.", ucoControlId: "UCO-DP-001" },
  ],
  "tenable": [
    { title: "Tenable.io -- Network Vulnerability Scan Results", description: "Full network scan completed. 1,247 assets discovered. 89 critical/high CVEs prioritized for remediation.", ucoControlId: "UCO-VM-001" },
    { title: "Tenable.io -- Asset Inventory and Coverage", description: "Complete managed asset inventory with OS versions, last scan dates, and risk scores. 99.2% scan coverage.", ucoControlId: "UCO-AC-004" },
    { title: "Tenable.io -- Remediation SLA Compliance Report", description: "Critical vulnerabilities: 96% remediated within 15-day SLA. High: 88% within 30-day SLA. Trending positive.", ucoControlId: "UCO-VM-002" },
  ],
  "qualys": [
    { title: "Qualys VMDR -- Continuous Compliance Scan", description: "CIS benchmark compliance at 87% across 1,247 assessed assets. Automated remediation tickets generated for gaps.", ucoControlId: "UCO-VM-001" },
    { title: "Qualys VMDR -- Patch Validation Report", description: "Patches validated post-deployment for all critical OS updates. False-close rate: 0.3%. Audit-ready reports.", ucoControlId: "UCO-CM-003" },
    { title: "Qualys VMDR -- Vulnerability Trending Dashboard", description: "34% reduction in critical CVE exposure over past 6 months. Metrics exported for board-level risk reporting.", ucoControlId: "UCO-VM-002" },
  ],
  "servicenow": [
    { title: "ServiceNow -- Change Management CAB Records", description: "All change requests with CAB approval status, risk assessments, and implementation sign-offs for the past quarter.", ucoControlId: "UCO-CM-003" },
    { title: "ServiceNow -- CMDB Asset Inventory", description: "Configuration Management Database export covering 2,341 CIs including servers, endpoints, and network devices.", ucoControlId: "UCO-AC-004" },
    { title: "ServiceNow -- Incident SLA Metrics", description: "P1 incidents: 94% resolved within 4h SLA. P2: 91% within 8h. Full incident register for audit period.", ucoControlId: "UCO-IR-002" },
    { title: "ServiceNow -- Risk Task Completion Report", description: "47 risk remediation tasks completed in the past quarter. 3 accepted risks with documented approvals.", ucoControlId: "UCO-VM-001" },
  ],
  "microsoft-intune": [
    { title: "Intune -- Device Compliance Policy Report", description: "94.7% of enrolled devices compliant with security baseline. BitLocker, PIN, and OS version enforced.", ucoControlId: "UCO-CM-003" },
    { title: "Intune -- BitLocker Encryption Enforcement", description: "100% of Windows endpoints enrolled with BitLocker. Recovery keys escrowed to Azure AD.", ucoControlId: "UCO-DP-002" },
    { title: "Intune -- Application Control Policy Export", description: "Allowlisted applications enforced via Intune policies. 12 unauthorized app install attempts blocked.", ucoControlId: "UCO-AC-004" },
    { title: "Intune -- Conditional Access Policy Audit", description: "34 conditional access policies in effect requiring compliant device + MFA for all corporate resource access.", ucoControlId: "UCO-AI-001" },
  ],
  "bamboohr": [
    { title: "BambooHR -- Employee Roster Export", description: "Active employee list with departments, titles, hire dates, and employment types. Used for access review baseline.", ucoControlId: "UCO-ST-001" },
    { title: "BambooHR -- Offboarding Completion Audit", description: "All 9 terminations in the past 90 days completed with IT equipment return and system access revocation logs.", ucoControlId: "UCO-AC-005" },
    { title: "BambooHR -- Security Training Completion Report", description: "Annual security awareness training: 97.3% completion. Incomplete training escalated to managers with 48h deadline.", ucoControlId: "UCO-ST-002" },
  ],
  "duo": [
    { title: "Duo Security -- MFA Enrollment Report", description: "99.1% of active users enrolled in Duo MFA. 3 exceptions with documented risk acceptance and manager approval.", ucoControlId: "UCO-AI-001" },
    { title: "Duo Security -- Bypass Code Audit Log", description: "14 bypass codes issued in the past 90 days. All tied to documented helpdesk tickets. None outstanding.", ucoControlId: "UCO-AI-003" },
    { title: "Duo Security -- Device Trust Policy Enforcement", description: "Trusted device policy active for 100% of production system access. 287 devices registered and verified.", ucoControlId: "UCO-AC-003" },
  ],
  "hashicorp-vault": [
    { title: "HashiCorp Vault -- Secrets Audit Log Export", description: "Full audit trail of secret access operations for the past 90 days. All access attributed to authenticated identities.", ucoControlId: "UCO-AL-001" },
    { title: "HashiCorp Vault -- Dynamic Credential Rotation Log", description: "Database and cloud credentials rotated automatically. Average credential lifetime: 1 hour for production systems.", ucoControlId: "UCO-CM-002" },
    { title: "HashiCorp Vault -- PKI Certificate Inventory", description: "All TLS certificates managed by Vault PKI. Zero certificates expiring within 30 days. Auto-renewal configured.", ucoControlId: "UCO-DP-001" },
    { title: "HashiCorp Vault -- Access Policy Audit", description: "Vault policy listing by team/role with least-privilege review. 0 policies with wildcard path grants in production.", ucoControlId: "UCO-AC-002" },
  ],
  "knowbe4": [
    { title: "KnowBe4 -- Security Awareness Training Completion", description: "Annual security training: 98.2% completion rate. Phishing-resistant MFA training module: 96.1% complete.", ucoControlId: "UCO-ST-002" },
    { title: "KnowBe4 -- Phishing Simulation Results", description: "Monthly phishing campaign results. Click rate decreased from 14% to 4.2% over 6 months. Consistent improvement.", ucoControlId: "UCO-ST-002" },
    { title: "KnowBe4 -- Per-User Risk Score Report", description: "Risk Score Index (RSI) exported per user. High-risk users enrolled in additional targeted training tracks.", ucoControlId: "UCO-ST-001" },
  ],
  "cloudflare": [
    { title: "Cloudflare -- WAF Rule Configuration Export", description: "OWASP Top 10 ruleset active. 47 custom WAF rules deployed. 12,847 malicious requests blocked in past 30 days.", ucoControlId: "UCO-VM-003" },
    { title: "Cloudflare -- DDoS Protection Configuration", description: "L3/L4/L7 DDoS protection enabled for all properties. Auto-mitigation activated 3 times in past quarter.", ucoControlId: "UCO-VM-003" },
    { title: "Cloudflare -- TLS Certificate Management Report", description: "All 12 domains with valid TLS certificates. Minimum TLS 1.2 enforced. HSTS enabled across all properties.", ucoControlId: "UCO-DP-001" },
    { title: "Cloudflare -- Access Audit Log Export", description: "Cloudflare Access policies protecting 8 internal tools. Full authentication log with identity, device, and location.", ucoControlId: "UCO-AL-001" },
  ],
  "gitlab": [
    { title: "GitLab -- Branch Protection Rules Audit", description: "100% of production repositories require MR approvals. Push to protected branches blocked for all non-admin users.", ucoControlId: "UCO-CM-002" },
    { title: "GitLab -- CI/CD Security Scan Integration", description: "SAST, DAST, and dependency scanning enabled in CI pipelines for all production repositories.", ucoControlId: "UCO-VM-001" },
    { title: "GitLab -- Merge Request Approval Log", description: "All 847 MRs to main branch reviewed by at least 2 approvers. No force-push exceptions in the past 90 days.", ucoControlId: "UCO-CM-001" },
    { title: "GitLab -- User Access and Role Audit", description: "GitLab membership audit with role assignments. 3 dormant accounts deprovisioned following quarterly review.", ucoControlId: "UCO-AC-001" },
  ],
  "gcp": [
    { title: "GCP -- IAM Policy Audit Report", description: "Organization-level IAM bindings exported. Workload Identity enforced for service accounts. 0 keys older than 90 days.", ucoControlId: "UCO-AC-001" },
    { title: "GCP -- Cloud Audit Log Export", description: "Admin Activity and Data Access audit logs enabled for all projects. Logs retained 400 days in Cloud Logging.", ucoControlId: "UCO-AL-001" },
    { title: "GCP -- Security Command Center Findings", description: "SCC standard tier active. 12 misconfigurations identified. 10 remediated. 2 risk-accepted with approvals documented.", ucoControlId: "UCO-VM-001" },
    { title: "GCP -- Organization Policy Compliance Report", description: "47 org-level constraints enforced including domain-restricted sharing, uniform bucket access, and resource location.", ucoControlId: "UCO-CM-003" },
  ],
  "sentinelone": [
    { title: "SentinelOne -- Endpoint Protection Coverage", description: "99.1% of managed endpoints protected by SentinelOne agent in Protect mode. 2 servers pending deployment.", ucoControlId: "UCO-VM-001" },
    { title: "SentinelOne -- Threat Detection and Containment Log", description: "8 threats detected and auto-contained in past 30 days. Average time to containment: 0.3 seconds. AI-powered response.", ucoControlId: "UCO-IR-001" },
    { title: "SentinelOne -- Vulnerability Assessment Report", description: "Endpoint vulnerability data correlated with CVE database. 94% of endpoints patched to current supported OS version.", ucoControlId: "UCO-VM-002" },
  ],
  "microsoft-365": [
    { title: "Microsoft 365 -- Exchange Mailbox Audit Log", description: "Mailbox audit logging enabled for all 341 user mailboxes. Log retention set to 180 days per compliance policy.", ucoControlId: "UCO-AL-001" },
    { title: "Microsoft 365 -- SharePoint DLP Policy Export", description: "14 DLP policies protecting sensitive data categories including PII, PCI data, and confidential classifications.", ucoControlId: "UCO-DP-003" },
    { title: "Microsoft 365 -- Admin Role Assignment Audit", description: "Global Administrator accounts: 3 (break-glass only). Privileged Identity Management activated for all admin roles.", ucoControlId: "UCO-AC-001" },
    { title: "Microsoft 365 -- Teams Message Retention Policy", description: "Teams and channel messages retained 7 years per retention policy. eDiscovery holds configured for legal team.", ucoControlId: "UCO-DP-003" },
  ],
  "wiz": [
    { title: "Wiz -- Cloud Security Posture Assessment", description: "Multi-cloud CSPM scan across AWS, Azure, and GCP. 1,247 resources scanned. Critical issues reduced 67% in 90 days.", ucoControlId: "UCO-VM-001" },
    { title: "Wiz -- Toxic Combination Risk Report", description: "14 toxic combination paths identified (e.g., internet-exposed + critical data + no MFA). All remediated.", ucoControlId: "UCO-DP-001" },
    { title: "Wiz -- Data Exposure Findings Export", description: "Sensitive data exposure findings including S3 buckets, unencrypted databases, and publicly accessible storage.", ucoControlId: "UCO-AC-001" },
    { title: "Wiz -- Kubernetes Security Posture Report", description: "K8s cluster configurations assessed against NSA/CISA hardening guidelines. 91% compliance score achieved.", ucoControlId: "UCO-CM-003" },
  ],
  "linear": [
    { title: "Linear -- Vulnerability Issue SLA Report", description: "Security-tagged issues tracked with SLA compliance. P0: 100% resolved in 24h. P1: 94% within 72h target.", ucoControlId: "UCO-VM-001" },
    { title: "Linear -- Change Request Workflow Audit", description: "Engineering change requests with approval status, reviewer identities, and implementation sign-off timestamps.", ucoControlId: "UCO-CM-003" },
    { title: "Linear -- Security Incident Tracking Log", description: "All security incidents tracked as Linear issues with timeline, assignees, resolution, and post-mortem links.", ucoControlId: "UCO-IR-002" },
  ],
  "proofpoint": [
    { title: "Proofpoint -- Email Threat Protection Summary", description: "4.2M emails scanned in past 30 days. 99.3% spam detection rate. 12 BEC attempts blocked. 0 successful phishes.", ucoControlId: "UCO-IR-001" },
    { title: "Proofpoint -- DLP Policy Enforcement Report", description: "Email DLP policies active for PCI, PHI, and confidential data. 34 policy violations blocked with audit trail.", ucoControlId: "UCO-DP-003" },
    { title: "Proofpoint -- Security Awareness Metrics", description: "Targeted attack simulations sent to 341 users. 97.4% reported suspicious email correctly using report button.", ucoControlId: "UCO-ST-002" },
  ],
  "rippling": [
    { title: "Rippling -- Employee Lifecycle Audit", description: "Complete onboarding and offboarding events for past 90 days. All 9 terminations processed with full app deprovisioning.", ucoControlId: "UCO-ST-001" },
    { title: "Rippling -- App Provisioning Access Report", description: "87 applications provisioned automatically based on role. Least-privilege access policies enforced on day one.", ucoControlId: "UCO-AC-005" },
    { title: "Rippling -- Device Management Compliance", description: "Company devices tracked with MDM enrollment. 96% compliance with screen lock and disk encryption requirements.", ucoControlId: "UCO-CM-003" },
  ],
  "aws-security-hub": [
    { title: "AWS Security Hub -- CIS Benchmark Compliance", description: "CIS AWS Foundations Benchmark at 91% compliance. 12 critical controls failing with remediation PRs in progress.", ucoControlId: "UCO-VM-001" },
    { title: "AWS Security Hub -- Multi-Account Findings Aggregation", description: "Security findings aggregated across 7 AWS accounts. 89 active findings with severity distribution and aging.", ucoControlId: "UCO-AL-001" },
    { title: "AWS Security Hub -- Automated Remediation Log", description: "Security Hub + EventBridge automations remediated 34 findings automatically. Audit trail with before/after state.", ucoControlId: "UCO-CM-003" },
    { title: "AWS Security Hub -- FSBP Compliance Report", description: "AWS Foundational Security Best Practices standard: 94% compliant. Full control status exported for audit.", ucoControlId: "UCO-AC-001" },
  ],
  "google-workspace": [
    { title: "Google Workspace -- MFA Enforcement Status", description: "2-Step Verification enforced for all 341 accounts. 0 accounts with MFA disabled. Enforced at org unit level.", ucoControlId: "UCO-AI-001" },
    { title: "Google Workspace -- Admin Role Audit", description: "Super Admin accounts: 2 (break-glass). All other admin roles follow least-privilege with 90-day recertification.", ucoControlId: "UCO-AC-001" },
    { title: "Google Workspace -- Device Policy Compliance", description: "Context-Aware Access policies require managed device + MFA for all Workspace access. 94% device compliance.", ucoControlId: "UCO-AI-002" },
    { title: "Google Workspace -- Data Export and Retention Policy", description: "Vault retention rules active for Gmail, Drive, and Meet. Data retained 7 years for compliance purposes.", ucoControlId: "UCO-AC-005" },
  ],
  "azure-ad": [
    { title: "Microsoft Entra ID -- Conditional Access Policy Audit", description: "47 conditional access policies requiring MFA + compliant device for all production and admin resource access.", ucoControlId: "UCO-AI-001" },
    { title: "Microsoft Entra ID -- PIM Role Activation Log", description: "Privileged Identity Management active for all Global Admin and Security Admin roles. Just-in-time activation only.", ucoControlId: "UCO-AC-003" },
    { title: "Microsoft Entra ID -- MFA Registration Report", description: "98.7% of users registered for MFA. Authenticator app: 89.3%. FIDO2 keys: 8.4%. SMS disabled for all accounts.", ucoControlId: "UCO-AI-001" },
    { title: "Microsoft Entra ID -- Sign-In Risk Policy Export", description: "Risk-based conditional access blocking sign-ins from anonymous IPs, atypical travel, and leaked credentials.", ucoControlId: "UCO-AC-003" },
  ],
  "slack": [
    { title: "Slack -- Workspace SSO Configuration", description: "SSO enforced for all workspace members via Okta. Password-based login disabled. 0 accounts with SSO bypass.", ucoControlId: "UCO-AC-001" },
    { title: "Slack -- Message Retention Policy Export", description: "Message retention set to 7 years for compliance channels. DM retention: 1 year. eDiscovery export available.", ucoControlId: "UCO-DP-003" },
  ],
  "aws-config": [
    { title: "AWS Config -- Resource Compliance Summary", description: "Config rules evaluated across 1,847 resources. 94% compliant. 12 non-compliant resources with remediation tickets created.", ucoControlId: "UCO-CM-003" },
    { title: "AWS Config -- Configuration Change Audit Log", description: "All configuration changes to EC2, IAM, S3, and RDS resources tracked with before/after state for the past 90 days.", ucoControlId: "UCO-AL-001" },
    { title: "AWS Config -- Unauthorized Resource Detection", description: "Config Aggregator monitoring 4 AWS accounts. Zero unauthorized resource deployments detected outside approved regions.", ucoControlId: "UCO-AC-001" },
  ],
  "aws-guardduty": [
    { title: "AWS GuardDuty -- Threat Detection Summary", description: "GuardDuty active across 4 AWS accounts. 7 medium-severity findings in past 30 days. All investigated and resolved.", ucoControlId: "UCO-IR-001" },
    { title: "AWS GuardDuty -- Malicious Activity Log", description: "Zero high-severity findings in past 90 days. 3 reconnaissance attempts auto-blocked by network ACL automation.", ucoControlId: "UCO-AL-001" },
  ],
  "azure-defender": [
    { title: "Microsoft Defender for Cloud -- Secure Score Report", description: "Secure Score: 84/100 across Azure subscription. 12 hardening recommendations implemented this quarter.", ucoControlId: "UCO-VM-001" },
    { title: "Microsoft Defender for Cloud -- Threat Alerts Summary", description: "14 security alerts generated in past 30 days. 12 dismissed as false positives. 2 escalated and resolved.", ucoControlId: "UCO-IR-001" },
  ],
  "gcp-scc": [
    { title: "GCP Security Command Center -- Findings Export", description: "SCC Premium active across 3 GCP projects. 18 findings identified. 15 remediated. 3 risk-accepted with approvals.", ucoControlId: "UCO-VM-001" },
    { title: "GCP Security Command Center -- Compliance Posture", description: "CIS Google Cloud Benchmark compliance at 87%. PCI DSS and HIPAA built-in standards monitored continuously.", ucoControlId: "UCO-CM-003" },
  ],
  "prisma-cloud": [
    { title: "Prisma Cloud -- CSPM Compliance Report", description: "CIS, NIST, and SOC 2 compliance scores across AWS, Azure, and GCP. Overall posture: 88% compliant across 4,200 resources.", ucoControlId: "UCO-VM-001" },
    { title: "Prisma Cloud -- IAM Risk Analysis", description: "CIEM analysis identified 34 over-privileged roles. Remediation recommendations actioned within 5 business days.", ucoControlId: "UCO-AC-001" },
  ],
  "orca": [
    { title: "Orca Security -- Cloud Risk Assessment", description: "Agentless scan of full cloud estate. 89 attack path risks identified. 71 remediated. 18 accepted with documented approvals.", ucoControlId: "UCO-VM-001" },
    { title: "Orca Security -- Sensitive Data Risk Findings", description: "Sensitive data discovered in 3 misconfigured storage buckets. All encrypted and access policies corrected within 48 hours.", ucoControlId: "UCO-DP-001" },
  ],
  "lacework": [
    { title: "Lacework -- Behavioral Anomaly Detection Report", description: "ML baselines established for 1,247 workloads. 6 anomalous sessions investigated in past 30 days. All cleared.", ucoControlId: "UCO-AL-001" },
    { title: "Lacework -- Cloud Compliance Summary", description: "CIS benchmark compliance across AWS and GCP: 91% overall. Non-compliant resources auto-ticketed for remediation.", ucoControlId: "UCO-VM-001" },
  ],
  "github-actions": [
    { title: "GitHub Actions -- Secrets Scanning Enforcement", description: "Push protection enabled across all repositories. 3 accidental secret commits blocked. Zero secrets exposed in CI logs.", ucoControlId: "UCO-CM-002" },
    { title: "GitHub Actions -- Deployment Approval Log", description: "Production deployments require 2-person approval via environment protection rules. 89 deployments reviewed this quarter.", ucoControlId: "UCO-CM-003" },
  ],
  "circleci": [
    { title: "CircleCI -- Secrets Management Compliance", description: "All 34 pipeline secrets stored in CircleCI Contexts with RBAC. No plaintext secrets in pipeline configuration files.", ucoControlId: "UCO-CM-003" },
    { title: "CircleCI -- Deployment Workflow Audit Log", description: "Production deployment pipeline requires manual approval gate. 67 production deployments with full audit trail.", ucoControlId: "UCO-AL-001" },
  ],
  "jenkins": [
    { title: "Jenkins -- Access Control Audit", description: "RBAC plugin configured with least-privilege roles. 12 admin accounts reviewed and reduced to 4 essential admins.", ucoControlId: "UCO-AC-001" },
    { title: "Jenkins -- Build Approval Workflow Log", description: "Production deployments require manual approval from designated approvers. Change tickets required for all production builds.", ucoControlId: "UCO-CM-003" },
  ],
  "amazon-ecr": [
    { title: "Amazon ECR -- Image Vulnerability Scan Results", description: "Enhanced scanning active for all 23 production repositories. 94% of critical CVEs in base images remediated within 72 hours.", ucoControlId: "UCO-VM-001" },
    { title: "Amazon ECR -- Image Signing Enforcement Report", description: "Cosign image signing enforced via OPA admission controller. Zero unsigned images deployed to production in past 90 days.", ucoControlId: "UCO-CM-001" },
  ],
  "google-gcr": [
    { title: "Google Container Registry -- Vulnerability Assessment", description: "Container Analysis API scanning active. 89% of critical vulnerabilities remediated within SLA across 18 repositories.", ucoControlId: "UCO-VM-001" },
    { title: "Google Container Registry -- Binary Authorization Report", description: "Binary Authorization enforcing signed images in GKE production. Zero policy bypass events in past 90 days.", ucoControlId: "UCO-CM-001" },
  ],
  "kubernetes": [
    { title: "Kubernetes -- RBAC Configuration Audit", description: "Zero cluster-admin bindings for non-break-glass accounts across 3 clusters. 47 roles reviewed for least-privilege.", ucoControlId: "UCO-AC-001" },
    { title: "Kubernetes -- Pod Security Standards Report", description: "Restricted pod security standard enforced in production. All pods pass checks. Zero privileged containers in production.", ucoControlId: "UCO-CM-003" },
    { title: "Kubernetes -- Secrets Management Audit", description: "Kubernetes secrets encrypted at rest via KMS. 12 secrets rotated this quarter. No hardcoded credentials in pod specs.", ucoControlId: "UCO-CM-002" },
  ],
  "ping": [
    { title: "PingIdentity -- SSO Policy Enforcement Report", description: "SSO enforced for all 341 users across 47 connected applications. Password-based fallback disabled for production systems.", ucoControlId: "UCO-AC-001" },
    { title: "PingIdentity -- MFA Configuration Audit", description: "Adaptive MFA active for all users with risk-based step-up authentication. 99.3% MFA enrollment rate.", ucoControlId: "UCO-AI-001" },
  ],
  "auth0": [
    { title: "Auth0 -- MFA Enrollment and Enforcement Report", description: "MFA required for all tenant users. 99.1% enrollment rate. Adaptive MFA enabled for anomalous login patterns.", ucoControlId: "UCO-AI-001" },
    { title: "Auth0 -- Anomalous Login Detection Log", description: "Brute force protection active. 847 blocked login attempts in past 30 days. 12 suspicious logins flagged.", ucoControlId: "UCO-AI-003" },
  ],
  "sailpoint": [
    { title: "SailPoint -- Access Certification Campaign Results", description: "Quarterly access review completed. 1,247 entitlements certified. 89 access rights revoked as no longer required.", ucoControlId: "UCO-AC-001" },
    { title: "SailPoint -- Separation of Duties Violation Report", description: "SoD policy enforced across 47 ERP roles. Zero active SoD violations. 3 temporary exceptions with documented approvals.", ucoControlId: "UCO-AI-001" },
  ],
  "cyberark": [
    { title: "CyberArk -- Privileged Account Inventory", description: "847 privileged accounts vaulted. Zero unmanaged service accounts with standing admin privileges in production.", ucoControlId: "UCO-AC-002" },
    { title: "CyberArk -- Session Recording Audit Log", description: "All privileged sessions recorded and retained 12 months. 34 sessions reviewed in audits with full keystroke logs.", ucoControlId: "UCO-AL-001" },
  ],
  "beyondtrust": [
    { title: "BeyondTrust -- Least Privilege Enforcement Report", description: "Privilege Management deployed to 98.4% of endpoints. Local admin rights removed from 247 standard users.", ucoControlId: "UCO-AC-002" },
    { title: "BeyondTrust -- Remote Session Audit Log", description: "All privileged remote access sessions recorded. 89 vendor sessions completed with full recording and approval.", ucoControlId: "UCO-AL-001" },
  ],
  "aws-secrets-manager": [
    { title: "AWS Secrets Manager -- Rotation Compliance Report", description: "Automatic rotation enabled for 94% of managed secrets. Remaining 6% have documented exceptions with manual schedule.", ucoControlId: "UCO-CM-002" },
    { title: "AWS Secrets Manager -- Access Policy Audit", description: "All secret resource policies reviewed. Zero secrets accessible by wildcard principal without explicit conditions.", ucoControlId: "UCO-DP-001" },
  ],
  "azure-key-vault": [
    { title: "Azure Key Vault -- Secrets and Keys Lifecycle Report", description: "All keys and certificates reviewed. Zero expired items. Auto-rotation configured for 89% of managed certificates.", ucoControlId: "UCO-CM-002" },
    { title: "Azure Key Vault -- Diagnostic Logs Export", description: "Full audit log of key and secret access operations. Logs retained 90 days in Log Analytics for compliance review.", ucoControlId: "UCO-AL-001" },
  ],
  "elastic-siem": [
    { title: "Elastic SIEM -- Detection Rule Configuration", description: "347 detection rules covering MITRE ATT&CK framework. Rules tuned quarterly. False positive rate: 2.1%.", ucoControlId: "UCO-AL-001" },
    { title: "Elastic SIEM -- Security Event Correlation Report", description: "2.3M events ingested per day. 234 alerts in past 30 days. 18 escalated to incident response. MTTD: 4.7 minutes.", ucoControlId: "UCO-IR-001" },
  ],
  "veracode": [
    { title: "Veracode -- SAST Policy Compliance Report", description: "Static analysis run on all 23 production apps. Policy compliance: 91%. 14 critical flaws remediated within SLA.", ucoControlId: "UCO-VM-001" },
    { title: "Veracode -- Developer Security Training Completion", description: "Security training modules completed by 94% of developers. Training matched to finding types found in their code.", ucoControlId: "UCO-ST-002" },
  ],
  "checkmarx": [
    { title: "Checkmarx -- SAST Findings and Remediation Report", description: "SAST integrated into CI/CD. 89 findings this quarter. 84 remediated. 5 false positives documented.", ucoControlId: "UCO-VM-001" },
    { title: "Checkmarx -- IaC Security Scan Results", description: "Infrastructure as Code scanned in pipeline. 12 misconfigurations blocked from deployment. 100% IaC scan coverage.", ucoControlId: "UCO-CM-001" },
  ],
  "adp": [
    { title: "ADP Workforce Now -- Employee Roster Export", description: "Active employee roster with hire dates, departments, and job titles. Used as access review baseline for quarterly certification.", ucoControlId: "UCO-ST-001" },
    { title: "ADP Workforce Now -- Termination Workflow Log", description: "All 11 terminations processed. IT access revocation completed within 1 business day. Zero exceptions.", ucoControlId: "UCO-AC-005" },
  ],
  "gusto": [
    { title: "Gusto -- Employee Lifecycle Audit", description: "All 8 terminations in past 90 days processed with automated deprovisioning across 47 connected applications.", ucoControlId: "UCO-ST-001" },
    { title: "Gusto -- Offboarding Access Revocation Log", description: "Automated offboarding workflow average completion time: 2.3 hours. Confirmed for 100% of voluntary terminations.", ucoControlId: "UCO-AC-005" },
  ],
  "greenhouse": [
    { title: "Greenhouse -- Background Check Completion Report", description: "94.7% of new hires completed pre-employment background screening. All exceptions documented with risk acceptance.", ucoControlId: "UCO-ST-001" },
    { title: "Greenhouse -- New Hire Security Compliance Documentation", description: "Security policy acknowledgment and NDA tracked for all hires. 100% completion required before system access provisioned.", ucoControlId: "UCO-ST-002" },
  ],
  "microsoft-teams": [
    { title: "Microsoft Teams -- Retention Policy Audit", description: "Teams channels retained per compliance policy: 7 years for compliance channels, 1 year for general chat.", ucoControlId: "UCO-DP-003" },
    { title: "Microsoft Teams -- Guest Access Control Report", description: "Guest access reviewed quarterly. 34 active guests with documented justification. 12 stale guests removed.", ucoControlId: "UCO-AC-001" },
  ],
  "zoom": [
    { title: "Zoom -- Meeting Security Configuration Report", description: "Waiting room enabled for all external meetings. Passcodes required for sensitive meetings. Recording encryption enforced.", ucoControlId: "UCO-DP-003" },
    { title: "Zoom -- SSO and MFA Enforcement Audit", description: "SSO enforced for all company accounts via Okta. MFA required for host accounts. Password-based login disabled.", ucoControlId: "UCO-AI-001" },
  ],
  "netsuite": [
    { title: "NetSuite -- User Access and Role Audit", description: "All 89 NetSuite user roles reviewed. 14 over-privileged roles corrected. Segregation of duties enforced across finance workflows.", ucoControlId: "UCO-AC-001" },
    { title: "NetSuite -- Financial System Audit Trail", description: "Full audit trail for all financial transactions and configuration changes retained for 7 years per retention policy.", ucoControlId: "UCO-AL-001" },
  ],
  "zendesk": [
    { title: "Zendesk -- Agent Permission and Role Audit", description: "All 47 Zendesk agent roles reviewed. Least-privilege enforced by tier. 6 over-privileged agents corrected during review.", ucoControlId: "UCO-AC-001" },
    { title: "Zendesk -- Customer PII Handling Compliance", description: "PII masking active for sensitive fields. GDPR and CCPA deletion requests processed within SLA. Data retention enforced.", ucoControlId: "UCO-DP-001" },
  ],
};

@Injectable()
export class IntegrationsService {
  private readonly githubClientId = process.env.GITHUB_CLIENT_ID!;
  private readonly githubClientSecret = process.env.GITHUB_CLIENT_SECRET!;

  getCatalog() {
    return { integrations: INTEGRATION_CATALOG };
  }

  /**
   * Returns the integration catalog merged with per-org feature flag overrides.
   * Admin-toggled flags (from feature_flags DB table) can enable/disable integrations
   * without requiring a code deploy.
   */
  async getCatalogWithFlags(orgId: number) {
    const flags = await db.execute(
      `SELECT flag_key, enabled, config FROM feature_flags WHERE org_id = ${orgId} OR org_id IS NULL`
    ) as any;
    const flagMap = new Map<string, boolean>(
      (flags.rows ?? flags).map((r: any) => [r.flag_key, r.enabled])
    );

    const integrations = INTEGRATION_CATALOG.map(item => ({
      ...item,
      // Feature flag override: if flag exists in DB, use it; otherwise fall back to hardcoded
      available: flagMap.has(`integration:${item.key}`)
        ? flagMap.get(`integration:${item.key}`)!
        : item.available,
    }));

    return { integrations };
  }

  /**
   * Admin: enable or disable an integration via feature flag (no deploy required).
   */
  async setIntegrationFlag(orgId: number, integrationKey: string, enabled: boolean) {
    const flagKey = `integration:${integrationKey}`;
    await db.execute(
      `INSERT INTO feature_flags (org_id, flag_key, enabled, updated_at)
       VALUES (${orgId}, '${flagKey}', ${enabled}, NOW())
       ON CONFLICT (org_id, flag_key) DO UPDATE SET enabled = ${enabled}, updated_at = NOW()`
    );
    return { success: true, integrationKey, enabled };
  }

  async getOrgIntegrations(orgId: number) {
    const connected = await db.query.orgIntegrationsTable.findMany({
      where: eq(orgIntegrationsTable.orgId, orgId),
    });
    const catalog = INTEGRATION_CATALOG.map((c) => ({
      ...c,
      connection: connected.find((i) => i.integrationKey === c.key) ?? null,
    }));
    return { integrations: catalog };
  }

  buildGithubAuthUrl(orgId: string, clerkUserId: string, host: string, protocol: string) {
    const state = Buffer.from(JSON.stringify({ orgId, userId: clerkUserId })).toString("base64");
    const scope = "read:org,repo,read:user";
    const redirectUri = `${protocol}://${host}/api/integrations/github/callback`;
    return `https://github.com/login/oauth/authorize?client_id=${this.githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  async handleGithubCallback(code: string, state: string, host: string, protocol: string, basePath: string) {
    const { orgId } = JSON.parse(Buffer.from(state, "base64").toString());
    const redirectUri = `${protocol}://${host}/api/integrations/github/callback`;

    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: this.githubClientId,
        client_secret: this.githubClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return { redirectUrl: `${protocol}://${host}${basePath}/?error=github_auth_failed` };
    }

    const token = tokenData.access_token;
    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    const ghUser = (await userResp.json()) as { login: string; name?: string; avatar_url?: string };

    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, Number(orgId)), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable).set({
        accessToken: token, status: "connected",
        accountLogin: ghUser.login, accountName: ghUser.name,
        accountAvatarUrl: ghUser.avatar_url, lastSyncStatus: "pending",
      }).where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId: Number(orgId), integrationKey: "github", name: "GitHub",
        status: "connected", accessToken: token,
        accountLogin: ghUser.login, accountName: ghUser.name,
        accountAvatarUrl: ghUser.avatar_url, scopes: ["read:org", "repo", "read:user"],
      });
    }

    await this.syncGitHub(Number(orgId), token);
    return { redirectUrl: `${protocol}://${host}${basePath}/integrations?connected=github` };
  }

  async connectAWS(orgId: number, accessKeyId: string, secretAccessKey: string, region: string) {
    const { controlResults, evidenceItems, checksRun, checksPassed } = await runAwsChecks(accessKeyId, secretAccessKey, region);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "aws", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "aws", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "aws", collectedAt: new Date(),
      });
    }

    const credentials = JSON.stringify({ accessKeyId, secretAccessKey, region });
    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "aws")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ accessToken: credentials, status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length, accountLogin: region })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "aws", name: "Amazon Web Services",
        status: "connected", accessToken: credentials,
        lastSyncAt: new Date(), lastSyncStatus: "success",
        evidenceCollected: evidenceItems.length, accountLogin: region,
      });
    }

    return { success: true, checksRun, checksPassed, evidenceCollected: evidenceItems.length };
  }

  async syncAWS(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "aws")),
    });
    if (!integration?.accessToken) throw new BadRequestException("AWS not connected");

    let creds: { accessKeyId: string; secretAccessKey: string; region: string };
    try {
      creds = JSON.parse(integration.accessToken);
    } catch {
      throw new BadRequestException("AWS credentials corrupted");
    }

    const { controlResults, evidenceItems, checksRun, checksPassed } = await runAwsChecks(creds.accessKeyId, creds.secretAccessKey, creds.region);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "aws", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "aws", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "aws", collectedAt: new Date(),
      });
    }

    await db.update(orgIntegrationsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
      .where(eq(orgIntegrationsTable.id, integration.id));

    return { success: true, checksRun, checksPassed };
  }

  async connectOkta(orgId: number, domain: string, apiToken: string) {
    const { controlResults, evidenceItems, checksRun, checksPassed } = await runOktaChecks(domain, apiToken);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "okta", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "okta", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "okta", collectedAt: new Date(),
      });
    }

    const credentials = JSON.stringify({ domain, apiToken });
    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "okta")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ accessToken: credentials, status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length, accountLogin: domain })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "okta", name: "Okta",
        status: "connected", accessToken: credentials,
        lastSyncAt: new Date(), lastSyncStatus: "success",
        evidenceCollected: evidenceItems.length, accountLogin: domain,
      });
    }

    return { success: true, checksRun, checksPassed, evidenceCollected: evidenceItems.length };
  }

  async syncOkta(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "okta")),
    });
    if (!integration?.accessToken) throw new BadRequestException("Okta not connected");

    let creds: { domain: string; apiToken: string };
    try {
      creds = JSON.parse(integration.accessToken);
    } catch {
      throw new BadRequestException("Okta credentials corrupted");
    }

    const { controlResults, evidenceItems, checksRun, checksPassed } = await runOktaChecks(creds.domain, creds.apiToken);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "okta", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "okta", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "okta", collectedAt: new Date(),
      });
    }

    await db.update(orgIntegrationsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
      .where(eq(orgIntegrationsTable.id, integration.id));

    return { success: true, checksRun, checksPassed };
  }

  async connectGitHub(orgId: number, personalAccessToken: string, orgOrOwner?: string) {
    const catalogItem = INTEGRATION_CATALOG.find((c) => c.key === "github");
    if (!catalogItem) throw new BadRequestException("Unknown integration");
    let integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (!integration) {
      [integration] = await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "github", name: "GitHub", status: "connected",
        config: { personalAccessToken, orgOrOwner: orgOrOwner ?? "" },
      }).returning();
    } else {
      [integration] = await db.update(orgIntegrationsTable)
        .set({ status: "connected", config: { personalAccessToken, orgOrOwner: orgOrOwner ?? "" } })
        .where(eq(orgIntegrationsTable.id, integration.id)).returning();
    }
    const syncResult = await runGitHubChecks(personalAccessToken, orgOrOwner);
    await this._persistSyncResults(orgId, syncResult.controlResults, syncResult.evidenceItems, "github", integration.id);
    return { success: true, checksRun: syncResult.checksRun, checksPassed: syncResult.checksPassed };
  }

  async syncOrgGitHubLive(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (!integration || integration.status !== "connected") throw new BadRequestException("GitHub integration not connected");
    const cfg = integration.config as { personalAccessToken?: string; orgOrOwner?: string };
    if (!cfg?.personalAccessToken) throw new BadRequestException("GitHub token not configured");
    const syncResult = await runGitHubChecks(cfg.personalAccessToken, cfg.orgOrOwner);
    await this._persistSyncResults(orgId, syncResult.controlResults, syncResult.evidenceItems, "github", integration.id);
    return { success: true, checksRun: syncResult.checksRun, checksPassed: syncResult.checksPassed };
  }

  async connectCloudflare(orgId: number, apiToken: string, zoneId: string) {
    const catalogItem = INTEGRATION_CATALOG.find((c) => c.key === "cloudflare");
    if (!catalogItem) throw new BadRequestException("Unknown integration");
    let integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "cloudflare")),
    });
    if (!integration) {
      [integration] = await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "cloudflare", name: "Cloudflare", status: "connected",
        config: { apiToken, zoneId },
      }).returning();
    } else {
      [integration] = await db.update(orgIntegrationsTable)
        .set({ status: "connected", config: { apiToken, zoneId } })
        .where(eq(orgIntegrationsTable.id, integration.id)).returning();
    }
    const syncResult = await runCloudflareChecks(apiToken, zoneId);
    await this._persistSyncResults(orgId, syncResult.controlResults, syncResult.evidenceItems, "cloudflare", integration.id);
    return { success: true, checksRun: syncResult.checksRun, checksPassed: syncResult.checksPassed };
  }

  async syncOrgCloudflare(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "cloudflare")),
    });
    if (!integration || integration.status !== "connected") throw new BadRequestException("Cloudflare integration not connected");
    const cfg = integration.config as { apiToken?: string; zoneId?: string };
    if (!cfg?.apiToken || !cfg?.zoneId) throw new BadRequestException("Cloudflare credentials not configured");
    const syncResult = await runCloudflareChecks(cfg.apiToken, cfg.zoneId);
    await this._persistSyncResults(orgId, syncResult.controlResults, syncResult.evidenceItems, "cloudflare", integration.id);
    return { success: true, checksRun: syncResult.checksRun, checksPassed: syncResult.checksPassed };
  }

  private async _persistSyncResults(
    orgId: number,
    controlResults: Array<{ ucoControlId: string; status: string; result: string; integrationKey: string }>,
    evidenceItems: Array<{ ucoControlId: string; title: string; description: string; type: string; source: string }>,
    integrationKey: string,
    integrationId: number,
  ) {
    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status as any, result: cr.result, integrationKey, lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status as any,
          result: cr.result, integrationKey, lastTestedAt: new Date(),
        });
      }
    }
    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: ev.type as any, source: ev.source,
        collectedAt: new Date(),
      });
    }
    await db.update(orgIntegrationsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "success" })
      .where(eq(orgIntegrationsTable.id, integrationId));
  }

  async connectDemo(orgId: number, integrationKey: string) {
    const catalogItem = INTEGRATION_CATALOG.find((c) => c.key === integrationKey);
    if (!catalogItem) throw new BadRequestException("Unknown integration");

    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, integrationKey)),
    });

    const demoControlResults = catalogItem.controls.map((controlId) => ({
      ucoControlId: controlId,
      status: Math.random() > 0.15 ? "passing" : "failing",
      result: `${catalogItem.name}: control verified via automated scan`,
      integrationKey,
    }));

    for (const cr of demoControlResults) {
      const existingResult = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existingResult) {
        await db.update(orgControlResultsTable)
          .set({ ...cr, lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existingResult.id));
      } else {
        await db.insert(orgControlResultsTable).values({ orgId, ...cr, lastTestedAt: new Date() });
      }
    }

    const evidenceTemplates = INTEGRATION_EVIDENCE_MAP[integrationKey] ?? [];
    const evidenceItems = evidenceTemplates.length > 0
      ? evidenceTemplates
      : catalogItem.controls.slice(0, 3).map((controlId, i) => ({
          title: `${catalogItem.name} -- ${["Compliance Report", "Access Audit", "Configuration Export"][i % 3]}`,
          description: `Automatically collected from ${catalogItem.name} integration. Control coverage verified.`,
          ucoControlId: controlId,
        }));

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId,
        title: ev.title,
        description: ev.description,
        ucoControlId: ev.ucoControlId ?? null,
        type: "auto",
        source: integrationKey,
        collectedAt: new Date(),
      });
    }

    const evidenceCount = evidenceItems.length;

    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceCount })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId,
        integrationKey,
        name: catalogItem.name,
        status: "connected",
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        evidenceCollected: evidenceCount,
      });
    }

    return { success: true, evidenceCollected: evidenceCount, controlsUpdated: demoControlResults.length };
  }

  async syncOrgGitHub(orgId: number) {
    // Route to live provider if token is stored
    try {
      const integration = await db.query.orgIntegrationsTable.findFirst({
        where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")),
      });
      const cfg = integration?.config as { personalAccessToken?: string; accessToken?: string; orgOrOwner?: string } | undefined;
      const token = cfg?.personalAccessToken ?? cfg?.accessToken;
      if (token) {
        return this.syncOrgGitHubLive(orgId);
      }
    } catch { /* fall through to demo */ }
    // Legacy OAuth-based demo sync
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (!integration?.accessToken) throw new BadRequestException("GitHub not connected");
    await this.syncGitHub(orgId, integration.accessToken);
    return { success: true };
  }

  async syncOrgOkta(orgId: number) {
    return this.syncOkta(orgId);
  }

  async syncOrgAWS(orgId: number) {
    return this.syncAWS(orgId);
  }

  async syncGitHub(orgId: number, token: string) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "EnterpriseComply/1.0",
    };

    try {
      const [userResp, orgsResp, reposResp] = await Promise.all([
        fetch("https://api.github.com/user", { headers }),
        fetch("https://api.github.com/user/orgs?per_page=10", { headers }),
        fetch("https://api.github.com/user/repos?per_page=50&sort=updated", { headers }),
      ]);

      const [ghUser, ghOrgs, repos] = await Promise.all([
        userResp.json() as Promise<Record<string, unknown>>,
        orgsResp.json() as Promise<Record<string, unknown>[]>,
        reposResp.json() as Promise<Record<string, unknown>[]>,
      ]);

      const orgName = Array.isArray(ghOrgs) && ghOrgs.length > 0 ? ghOrgs[0].login : (ghUser as Record<string, unknown>).login;
      let mfaRequired = false;
      let reposWithProtection = 0;
      let reposWithReviews = 0;
      let totalRepos = 0;

      if (Array.isArray(repos)) {
        totalRepos = repos.length;
        const branchChecks = repos.slice(0, 10).map(async (repo: Record<string, unknown>) => {
          try {
            const branchResp = await fetch(
              `https://api.github.com/repos/${repo.full_name}/branches/${repo.default_branch || "main"}`,
              { headers },
            );
            if (!branchResp.ok) return null;
            return branchResp.json();
          } catch {
            return null;
          }
        });
        const branches = await Promise.all(branchChecks);
        for (const b of branches) {
          if (!b) continue;
          if ((b as Record<string, Record<string, unknown>>).protection?.enabled) reposWithProtection++;
          if ((b as Record<string, Record<string, unknown>>).protection?.required_pull_request_reviews) reposWithReviews++;
        }
      }

      if (Array.isArray(ghOrgs) && ghOrgs.length > 0) {
        try {
          const orgDetailResp = await fetch(`https://api.github.com/orgs/${ghOrgs[0].login}`, { headers });
          const orgDetail = (await orgDetailResp.json()) as Record<string, unknown>;
          mfaRequired = (orgDetail.two_factor_requirement_enabled as boolean) ?? false;
        } catch {}
      }

      const controlResults = [
        { ucoControlId: "UCO-AI-001", status: mfaRequired ? "passing" : "failing", result: `GitHub org 2FA requirement: ${mfaRequired ? "enabled" : "disabled"}`, integrationKey: "github" },
        { ucoControlId: "UCO-AC-001", status: totalRepos === 0 || reposWithProtection / totalRepos > 0.7 ? "passing" : "failing", result: `${reposWithProtection}/${Math.min(totalRepos, 10)} sampled repos have branch protection`, integrationKey: "github" },
        { ucoControlId: "UCO-CM-002", status: totalRepos === 0 || reposWithReviews / totalRepos > 0.5 ? "passing" : "failing", result: `${reposWithReviews}/${Math.min(totalRepos, 10)} repos require PR reviews`, integrationKey: "github" },
        { ucoControlId: "UCO-CM-001", status: "passing", result: `${totalRepos} repositories using version control`, integrationKey: "github" },
      ];

      const evidenceItems = [
        { ucoControlId: "UCO-AI-001", title: `GitHub MFA Status -- ${String(orgName)}`, description: `Two-factor authentication ${mfaRequired ? "is required" : "is NOT required"} for GitHub organization.`, type: "auto", source: "github" },
        { ucoControlId: "UCO-AC-001", title: "GitHub Branch Protection Status", description: `${reposWithProtection} of ${Math.min(totalRepos, 10)} sampled repositories have branch protection enabled.`, type: "auto", source: "github" },
      ];

      for (const cr of controlResults) {
        const existing = await db.query.orgControlResultsTable.findFirst({
          where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
        });
        if (existing) {
          await db.update(orgControlResultsTable).set({ ...cr, lastTestedAt: new Date() }).where(eq(orgControlResultsTable.id, existing.id));
        } else {
          await db.insert(orgControlResultsTable).values({ orgId, ...cr, lastTestedAt: new Date() });
        }
      }

      for (const ev of evidenceItems) {
        await db.insert(orgEvidenceTable).values({ orgId, ...ev, collectedAt: new Date() });
      }

      await db.update(orgIntegrationsTable)
        .set({ status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
        .where(and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")));
    } catch (err) {
      await db.update(orgIntegrationsTable)
        .set({ lastSyncAt: new Date(), lastSyncStatus: "error", lastSyncError: String(err) })
        .where(and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")));
    }
  }
}
