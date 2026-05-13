import { Injectable } from "@nestjs/common";
import { db, orgPoliciesTable, orgPolicyAcknowledgmentsTable, orgPeopleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

export const POLICY_TEMPLATES = [
  {
    key: "acceptable-use",
    title: "Acceptable Use Policy",
    category: "security",
    description: "Defines acceptable use of company systems, data, and resources.",
    content: `ACCEPTABLE USE POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy defines the acceptable use of [Organization Name]'s information systems, computing devices, networks, and data. It establishes expectations for all users and protects the organization from security, legal, and reputational risk arising from misuse.

2. SCOPE
This policy applies to all employees, contractors, consultants, temporary workers, and any other persons who use [Organization Name] information systems or access organizational data, including remote and mobile access.

3. AUTHORIZED USE
3.1 Information systems and data must be used only for authorized, legitimate business purposes.
3.2 Incidental personal use is permitted provided it does not interfere with job performance, consume significant resources, violate any provision of this policy, or create legal liability for the organization.
3.3 Users must not access systems, data, or network resources for which they have not been expressly authorized.

4. PROHIBITED ACTIVITIES
Users must not:
- Access, store, transmit, or distribute content that is illegal, obscene, harassing, or discriminatory.
- Install unauthorized software, disable security controls, or modify system configurations without approval.
- Share credentials, passwords, or authentication tokens with any other person.
- Use organizational resources for personal commercial gain or competitive activities outside approved scope.
- Circumvent, disable, or interfere with security monitoring, logging, or access controls.
- Transmit sensitive or regulated data over unsecured channels without approved encryption.
- Engage in any activity that could expose the organization to legal liability or reputational harm.
- Attempt to gain unauthorized access to any system, account, or data, including through social engineering.

5. DATA HANDLING
5.1 All data must be handled in accordance with the Data Classification Policy.
5.2 Sensitive, confidential, or regulated data must not be stored on personal devices, unapproved cloud services, or removable media without explicit authorization.
5.3 Data must not be shared with unauthorized third parties under any circumstances.

6. MONITORING AND PRIVACY
6.1 Users have no expectation of privacy when using organizational systems, networks, or devices.
6.2 All activity on organizational systems may be monitored, logged, and audited for security, compliance, and operational purposes.
6.3 Monitoring activities will be conducted in accordance with applicable law and disclosed in employee agreements.

7. ROLES AND RESPONSIBILITIES
- Employees and Contractors: Comply fully with this policy and promptly report suspected violations.
- IT/Security Team: Maintain technical controls, monitor compliance, and investigate violations.
- Management: Enforce this policy within their teams and escalate violations appropriately.
- Human Resources: Administer disciplinary action for confirmed violations.

8. ENFORCEMENT
Violations of this policy may result in disciplinary action up to and including termination of employment or contract, and civil or criminal legal action where applicable. Security incidents arising from policy violations will be handled through the Incident Response Policy.

9. REVIEW
This policy will be reviewed annually by the Information Security team, or following any significant change to organizational systems, threat landscape, or applicable regulations. Approved changes require sign-off from the CISO or equivalent authority.`,
  },
  {
    key: "access-control",
    title: "Access Control Policy",
    category: "security",
    description: "Governs how access to systems is granted, managed, and revoked.",
    content: `ACCESS CONTROL POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes requirements for controlling access to [Organization Name]'s information systems, data, and infrastructure. It implements the principle of least privilege to ensure users have access only to the resources required to perform their authorized functions.

2. SCOPE
This policy applies to all information systems, applications, databases, cloud services, and network infrastructure owned or operated by [Organization Name], and to all users including employees, contractors, service accounts, and third parties.

3. PRINCIPLES
3.1 Least Privilege: Access rights must be limited to the minimum necessary to perform authorized job functions.
3.2 Need to Know: Access to sensitive data is granted only when there is a documented business need.
3.3 Separation of Duties: Critical functions must be distributed among multiple individuals to prevent fraud and error.
3.4 Zero Trust: No user or system is trusted by default; all access must be authenticated and authorized.

4. ACCESS PROVISIONING
4.1 All access requests must be submitted through the approved ticketing or provisioning system and require manager approval.
4.2 Access must not be provisioned until written authorization is received from the appropriate business owner.
4.3 Privileged access (administrator, root, or elevated permissions) requires additional approval from the CISO or IT management and must be documented.
4.4 Shared or generic accounts are prohibited except where technically unavoidable, and must be individually authorized, documented, and monitored.

5. AUTHENTICATION REQUIREMENTS
5.1 Multi-factor authentication (MFA) is required for all access to production systems, cloud environments, and systems containing sensitive or regulated data.
5.2 MFA is required for all remote access, including VPN and remote desktop connections.
5.3 Password requirements are defined in the Password Policy.
5.4 Single sign-on (SSO) must be used where available to reduce credential sprawl.

6. ACCESS REVIEWS
6.1 User access rights must be reviewed at minimum quarterly for privileged accounts and annually for standard accounts.
6.2 Access reviews must be documented and signed off by the responsible system owner or manager.
6.3 Excess access identified during reviews must be revoked within 5 business days.

7. ACCESS REVOCATION
7.1 Access must be revoked within 24 hours of employee termination or role change.
7.2 IT must receive formal notification from HR or management prior to or on the last day of employment.
7.3 All credentials, tokens, certificates, and physical access must be deactivated simultaneously upon departure.

8. PRIVILEGED ACCESS MANAGEMENT
8.1 Privileged accounts must be separate from standard user accounts.
8.2 Privileged sessions must be logged and subject to enhanced monitoring.
8.3 Standing privileged access must be minimized; just-in-time access is preferred where technically feasible.

9. ROLES AND RESPONSIBILITIES
- System Owners: Maintain accurate access lists and approve provisioning requests for their systems.
- IT/Security: Implement technical controls, conduct access reviews, and execute revocations.
- HR: Notify IT of hiring, termination, and role changes in a timely manner.
- Managers: Approve access requests and participate in periodic access reviews.
- Users: Request only necessary access and report unauthorized access immediately.

10. ENFORCEMENT
Violations, including unauthorized access attempts or failure to participate in access reviews, may result in disciplinary action and are subject to the Incident Response process.

11. REVIEW
This policy will be reviewed annually or following a significant security incident, regulatory change, or major system change.`,
  },
  {
    key: "incident-response",
    title: "Incident Response Policy",
    category: "security",
    description: "Procedures for detecting, reporting, and responding to security incidents.",
    content: `INCIDENT RESPONSE POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes a structured process for identifying, containing, investigating, remediating, and reporting security incidents. Effective incident response minimizes damage, reduces recovery time, and ensures regulatory obligations are met.

2. SCOPE
This policy applies to all information security incidents affecting [Organization Name]'s systems, data, personnel, or operations, regardless of origin. It applies to all employees, contractors, and third parties who interact with organizational systems.

3. INCIDENT DEFINITION
A security incident is any event that actually or potentially jeopardizes the confidentiality, integrity, or availability of information or systems. Examples include but are not limited to:
- Unauthorized access to systems or data
- Malware infection or ransomware
- Data breach or exfiltration
- Denial of service attacks
- Insider threat activity
- Loss or theft of devices containing sensitive data
- Phishing or social engineering attacks that result in account compromise

4. INCIDENT SEVERITY CLASSIFICATION
- Critical (P1): Systems or data with significant business impact are compromised; regulatory notification likely required. Response within 1 hour.
- High (P2): Significant disruption or confirmed data exposure with limited scope. Response within 4 hours.
- Medium (P3): Suspicious activity with potential for escalation; no confirmed compromise. Response within 24 hours.
- Low (P4): Minor policy violations or anomalous activity with low risk. Response within 72 hours.

5. INCIDENT RESPONSE PHASES

5.1 Detection and Reporting
All employees must report suspected security incidents immediately to the Security team via [incident reporting channel]. Reports should include: what was observed, when it occurred, which systems or data may be affected, and any actions already taken.

5.2 Triage and Containment
The Security team will assess severity, assign an incident owner, and implement initial containment measures within the timeframe defined by severity level. Containment may include isolating affected systems, disabling accounts, or blocking network traffic.

5.3 Investigation and Analysis
The incident owner will conduct a root cause analysis, preserve evidence (system logs, network captures, disk images), identify the full scope of impact, and determine whether data was accessed or exfiltrated.

5.4 Eradication
Remove the root cause of the incident. This may include removing malware, patching vulnerabilities, revoking compromised credentials, or reconfiguring systems.

5.5 Recovery
Restore affected systems to normal operation from known-good backups or clean configurations. Verify integrity before reconnecting to production networks. Monitor for recurrence.

5.6 Post-Incident Review
A lessons-learned review must be conducted within 5 business days of resolution for P1 and P2 incidents. The review must document root cause, timeline, response actions, and recommended improvements.

6. REGULATORY NOTIFICATION
6.1 The Legal and Compliance team must be notified immediately upon confirmation of any incident involving personal data or regulated information.
6.2 Regulatory notification timelines must be tracked: GDPR requires notification within 72 hours; HIPAA requires notification within 60 days; other timelines apply per applicable frameworks.
6.3 Customer notification decisions require approval from Legal and executive leadership.

7. INCIDENT RESPONSE TEAM
- Incident Response Lead (Security): Overall coordination and technical response
- Legal/Compliance: Regulatory notification and privilege management
- Communications/PR: External messaging and customer notification
- IT Operations: Technical containment and recovery
- HR: Personnel matters related to insider threats
- Executive Sponsor: Decision authority for major incidents

8. EVIDENCE PRESERVATION
All evidence related to a security incident must be preserved in its original form. Systems must not be wiped, reimaged, or altered during an active investigation without documented approval from the Incident Response Lead.

9. REVIEW
The Incident Response Policy and associated procedures will be tested annually via tabletop exercises or simulations. The policy will be updated following significant incidents or changes to the regulatory environment.`,
  },
  {
    key: "data-classification",
    title: "Data Classification Policy",
    category: "data",
    description: "Framework for categorizing and handling data by sensitivity level.",
    content: `DATA CLASSIFICATION POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes a classification framework for [Organization Name]'s data assets. Proper classification ensures that appropriate security controls are applied to protect data based on its sensitivity, regulatory requirements, and business value.

2. SCOPE
This policy applies to all data created, processed, stored, or transmitted by [Organization Name], including data in digital and physical form, regardless of location (on-premises, cloud, third-party systems, or employee devices).

3. CLASSIFICATION TIERS

3.1 PUBLIC
Definition: Information approved for public release with no adverse impact if disclosed.
Examples: Marketing materials, published press releases, public website content, open-source documentation.
Handling: No special controls required. May be freely shared externally.

3.2 INTERNAL
Definition: Information intended for internal use only. Disclosure could cause minor inconvenience or operational impact.
Examples: Internal policies, general business communications, meeting notes, internal directories.
Handling: Must not be shared with unauthorized external parties. Transmit over encrypted channels. Dispose of securely when no longer needed.

3.3 CONFIDENTIAL
Definition: Sensitive business information where unauthorized disclosure could cause material harm to the organization, customers, or partners.
Examples: Financial projections, contracts, customer lists, product roadmaps, HR records, business strategies.
Handling: Access restricted to need-to-know personnel. Encrypt at rest and in transit. Label documents appropriately. Do not transmit via personal email or unapproved services. Formal data sharing agreements required for third-party access.

3.4 RESTRICTED
Definition: Highly sensitive data subject to regulatory requirements or where disclosure could cause severe harm including legal liability, regulatory fines, or breach of contract.
Examples: Personally Identifiable Information (PII), Protected Health Information (PHI), Payment Card Data (PCI), authentication credentials, encryption keys, government Controlled Unclassified Information (CUI).
Handling: Strongest available encryption required. Access limited to specifically authorized individuals. MFA required for all access. Comprehensive audit logging required. Data must not leave approved environments without explicit authorization. Governed by applicable regulations (HIPAA, PCI DSS, GDPR, CMMC, etc.).

4. DATA LABELING
4.1 All documents and files containing Confidential or Restricted data must be labeled with the appropriate classification marking in the header or footer.
4.2 Electronic labels must be applied using approved DLP tooling where available.
4.3 Physical documents must be stamped or marked with the classification tier.

5. DATA HANDLING REQUIREMENTS BY TIER
| Requirement          | Public | Internal | Confidential | Restricted |
|---------------------|--------|----------|--------------|------------|
| Encrypt in transit  | No     | Yes      | Yes          | Yes (TLS 1.2+) |
| Encrypt at rest     | No     | No       | Yes          | Yes (AES-256) |
| MFA for access      | No     | No       | Recommended  | Required   |
| Audit logging       | No     | No       | Recommended  | Required   |
| DLP controls        | No     | No       | Yes          | Yes        |
| Secure disposal     | No     | Yes      | Yes          | Yes (certified) |

6. DATA DISPOSAL
Data must be disposed of securely at end of retention period per the Data Retention and Disposal Policy. Restricted data must be destroyed using NIST 800-88 compliant methods.

7. ROLES AND RESPONSIBILITIES
- Data Owners: Business leaders responsible for classifying data in their domain and authorizing access.
- Data Custodians: IT personnel responsible for implementing technical controls.
- All Employees: Correctly handle and label data in accordance with this policy.
- Legal/Compliance: Maintain awareness of regulatory requirements that affect classification.

8. REVIEW
This policy will be reviewed annually and whenever new categories of regulated data are introduced or regulatory requirements change.`,
  },
  {
    key: "password-policy",
    title: "Password Policy",
    category: "security",
    description: "Requirements for password complexity, rotation, storage, and MFA.",
    content: `PASSWORD AND AUTHENTICATION POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes minimum requirements for authentication credentials to protect [Organization Name]'s systems and data from unauthorized access resulting from weak, stolen, or compromised credentials.

2. SCOPE
This policy applies to all users with access to organizational systems, including employees, contractors, and service accounts. It applies to all passwords, PINs, passphrases, and other authentication credentials used to access organizational resources.

3. PASSWORD REQUIREMENTS

3.1 Minimum Standards
- Minimum length: 14 characters for standard accounts; 20 characters for privileged accounts.
- Must include a mix of uppercase letters, lowercase letters, numbers, and special characters, OR be a passphrase of at least 4 random words.
- Must not include the user's name, username, organization name, or common dictionary words as the primary component.
- Must not reuse any of the last 12 passwords.
- Must not be identical to passwords used for personal accounts.

3.2 Password Rotation
- Standard accounts: Passwords must be changed when there is suspicion of compromise or at least every 365 days if not using MFA. With MFA enforced, mandatory rotation is not required.
- Privileged accounts: Passwords must be rotated at minimum every 90 days and immediately upon personnel change.
- Service accounts: Passwords must be rotated at minimum annually and upon team member departures.
- Default credentials: All default manufacturer or system passwords must be changed before production deployment.

4. MULTI-FACTOR AUTHENTICATION (MFA)
4.1 MFA is mandatory for:
- All access to production systems and cloud environments.
- All remote access (VPN, remote desktop, SSH).
- All access to systems containing Confidential or Restricted data.
- All administrative or privileged accounts.
- All SaaS applications that support MFA.
4.2 Approved MFA methods: hardware security keys (FIDO2/WebAuthn preferred), authenticator apps (TOTP), push notifications from approved providers. SMS-based MFA is discouraged and should only be used where no stronger alternative is available.
4.3 MFA backup codes must be stored securely (password manager or printed and locked) and must not be stored in plain text.

5. PASSWORD STORAGE AND MANAGEMENT
5.1 A company-approved password manager must be used for storing all work credentials.
5.2 Passwords must never be stored in plaintext, spreadsheets, notes applications, or unencrypted files.
5.3 Systems must store passwords using a strong adaptive hashing algorithm (bcrypt, Argon2, or PBKDF2) with appropriate cost factors. MD5, SHA-1, and unsalted hashes are prohibited.
5.4 Passwords must never be transmitted in plaintext or logged in system logs.

6. PASSWORD SHARING
6.1 Passwords must never be shared between individuals under any circumstances.
6.2 Shared accounts are prohibited except where technically unavoidable and explicitly approved by the CISO.
6.3 Passwords must never be sent via email, instant message, or ticket systems, even in encrypted form.

7. ACCOUNT LOCKOUT
7.1 Accounts must be locked after a maximum of 10 consecutive failed authentication attempts.
7.2 Account lockout duration must be a minimum of 15 minutes, or require manual administrator unlock for privileged accounts.
7.3 Lockout events must be logged and reviewed for patterns indicating brute force attacks.

8. COMPROMISED CREDENTIALS
8.1 Users must immediately report suspected credential compromise to the Security team.
8.2 Upon confirmed compromise, passwords must be changed immediately and all active sessions terminated.
8.3 Credentials must be checked against known breach databases (e.g., HaveIBeenPwned) during provisioning and periodic reviews.

9. ROLES AND RESPONSIBILITIES
- All Users: Comply with password requirements, use the approved password manager, and report suspected compromise immediately.
- IT/Security: Enforce technical controls, monitor for anomalous authentication activity, and conduct periodic credential audits.
- System Owners: Implement appropriate authentication controls on systems under their ownership.

10. REVIEW
This policy will be reviewed annually or following any significant authentication-related security incident.`,
  },
  {
    key: "incident-response-plan",
    title: "Incident Response Plan",
    category: "security",
    description: "Operational procedures and contact information for executing incident response.",
    content: `[CUSTOMIZE] Update with organization-specific runbooks, contact details, and system inventory before publishing.\n\nThis document supplements the Incident Response Policy with operational procedures.`,
  },
  {
    key: "change-management",
    title: "Change Management Policy",
    category: "operations",
    description: "Process for managing changes to production systems and infrastructure.",
    content: `CHANGE MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy ensures that changes to [Organization Name]'s production systems, infrastructure, and applications are planned, tested, approved, and documented to minimize risk and maintain service availability and security.

2. SCOPE
This policy applies to all changes to production environments including software deployments, infrastructure modifications, configuration changes, firewall rule modifications, access control changes, and third-party integrations.

3. CHANGE CATEGORIES
- Standard Change: Pre-approved, low-risk, well-documented routine changes (e.g., approved patches). No individual approval required.
- Normal Change: Planned changes requiring risk assessment and Change Advisory Board (CAB) or manager approval before implementation.
- Emergency Change: Urgent changes required to restore service or address an active security incident. Post-implementation documentation required within 24 hours.

4. CHANGE PROCESS
4.1 All normal and emergency changes must be submitted as change requests in the approved change management system prior to implementation.
4.2 Change requests must include: description of the change, business justification, risk assessment, rollback plan, testing evidence, and implementation window.
4.3 Changes with significant risk or system-wide impact require CISO and engineering leadership approval.
4.4 All changes must be tested in a non-production environment before production deployment, unless an emergency requires otherwise.
4.5 A rollback plan must be prepared and tested before implementation.
4.6 Changes must be implemented during approved change windows unless classified as emergency.

5. POST-CHANGE REVIEW
5.1 All changes must be verified as successful or rolled back within the defined implementation window.
5.2 Failed or rolled-back changes must be documented and reviewed.
5.3 Significant changes must be reviewed in the next CAB meeting or retrospective.

6. ROLES AND RESPONSIBILITIES
- Change Requester: Submits change request with complete documentation.
- Change Approver (Manager/CAB): Reviews and approves or rejects the change.
- Change Implementer: Executes the change per the approved plan.
- Security Team: Reviews changes with security implications.

7. REVIEW
This policy will be reviewed annually or following a significant change-related incident.`,
  },
  {
    key: "vendor-management",
    title: "Vendor Management Policy",
    category: "risk",
    description: "Requirements for assessing and managing third-party vendor risk.",
    content: `VENDOR MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes requirements for assessing, onboarding, monitoring, and offboarding third-party vendors who have access to [Organization Name]'s systems, data, or infrastructure. It ensures that vendor relationships do not introduce unacceptable security, compliance, or operational risk.

2. SCOPE
This policy applies to all vendors, suppliers, and service providers who process, store, or transmit organizational data, or who have logical or physical access to organizational systems.

3. VENDOR CLASSIFICATION
- Critical Vendors: Vendors with access to Restricted data or who provide critical business services. Require full security assessment.
- High-Risk Vendors: Vendors with access to Confidential data. Require security questionnaire and contractual controls.
- Standard Vendors: Vendors with limited data access or no system access. Require contract review only.

4. VENDOR ONBOARDING
4.1 All new vendors must complete security assessment before access is provisioned, scaled to their risk classification.
4.2 Critical and High-Risk vendors must complete a security questionnaire and provide evidence of certifications (SOC 2, ISO 27001, or equivalent) where available.
4.3 All vendors with data access must execute a Data Processing Agreement (DPA) or equivalent contractual instrument before data is shared.
4.4 Vendor contracts must include security requirements, breach notification obligations (within 48 hours), right to audit, and data return/destruction requirements upon termination.

5. ONGOING MONITORING
5.1 Critical vendors must be reassessed annually.
5.2 Vendor security certifications must be reviewed upon renewal.
5.3 Vendor access must be reviewed quarterly as part of the access review program.
5.4 Security incidents involving vendors must be reported to the Security team immediately.

6. VENDOR OFFBOARDING
6.1 All vendor access must be revoked within 24 hours of contract termination.
6.2 Vendors must confirm destruction or return of all organizational data within 30 days of termination.
6.3 Data destruction certificates must be obtained for vendors handling Restricted data.

7. ROLES AND RESPONSIBILITIES
- Procurement/Legal: Contract execution and DPA management.
- Security Team: Security assessments and risk determination.
- Business Owner: Initiating vendor onboarding and ongoing relationship management.
- IT: Technical access provisioning and revocation.

8. REVIEW
This policy will be reviewed annually or following a vendor-related security incident or significant change in vendor landscape.`,
  },
  {
    key: "business-continuity",
    title: "Business Continuity Plan",
    category: "risk",
    description: "Plans for maintaining operations during and after disruptive events.",
    content: `BUSINESS CONTINUITY PLAN
Version: 1.0 | Review Cycle: Annual | Test Frequency: Annual

1. PURPOSE
This Business Continuity Plan (BCP) ensures that [Organization Name] can maintain or rapidly restore critical business functions in the event of a significant disruption, including natural disasters, cyberattacks, infrastructure failures, or public health emergencies.

2. SCOPE
This plan covers all critical business functions, systems, and processes required to deliver [Organization Name]'s core services and meet contractual and regulatory obligations.

3. BUSINESS IMPACT ANALYSIS
Critical business functions and their recovery objectives must be documented in the accompanying Business Impact Analysis (BIA). Key metrics:
- Recovery Time Objective (RTO): Maximum acceptable downtime before business impact becomes severe.
- Recovery Point Objective (RPO): Maximum acceptable data loss measured in time.
- Critical functions must achieve RTO of [X hours] and RPO of [X hours]. Customize based on BIA.

4. CONTINUITY STRATEGIES

4.1 Technology
- All critical systems must be backed up in accordance with the Backup and Recovery Policy.
- Recovery procedures for critical systems must be documented, tested, and kept current.
- Cloud-based systems must have documented failover procedures.
- On-premises infrastructure must have documented recovery procedures including hardware replacement timelines.

4.2 Personnel
- Critical functions must have at least two trained personnel capable of performing them.
- An emergency contact list for all key staff and leadership must be maintained and reviewed quarterly.
- Remote work capability must be maintained for all personnel performing critical functions.

4.3 Communications
- An emergency notification system must be used to reach all employees within 2 hours of an activation decision.
- A designated spokesperson must handle all external communications during a significant incident.
- Customer and partner communication templates must be prepared in advance.

5. PLAN ACTIVATION
5.1 The BCP may be activated by the CEO, COO, or CISO based on the severity of the disruption.
5.2 Upon activation, the Business Continuity Team (BCT) will convene immediately.
5.3 An activation log must be maintained throughout the event.

6. RECOVERY PHASES
Phase 1 - Immediate Response (0-4 hours): Assess situation, activate BCT, initiate emergency notifications.
Phase 2 - Short-Term Recovery (4-72 hours): Restore critical systems and communications, implement workarounds for disrupted processes.
Phase 3 - Full Recovery (72 hours+): Restore all operations to normal, document lessons learned, update the BCP.

7. TESTING AND MAINTENANCE
7.1 The BCP must be tested at minimum annually via a tabletop exercise or live drill.
7.2 Test results and identified gaps must be documented and remediated within 90 days.
7.3 The BCP must be updated following any significant test finding, organizational change, or actual activation.

8. REVIEW
This plan will be reviewed annually by the Security, IT, and Operations leadership and updated to reflect changes in systems, personnel, and risk environment.`,
  },
  {
    key: "encryption",
    title: "Encryption Policy",
    category: "security",
    description: "Standards for encrypting data at rest and in transit.",
    content: `ENCRYPTION POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes requirements for the use of cryptographic controls to protect [Organization Name]'s data at rest and in transit, ensuring data confidentiality and integrity in accordance with regulatory requirements and security best practices.

2. SCOPE
This policy applies to all systems, applications, devices, and storage media that process, store, or transmit Confidential or Restricted data, as defined in the Data Classification Policy.

3. ENCRYPTION STANDARDS

3.1 Approved Algorithms
- Symmetric encryption: AES-256 (preferred), AES-128 (minimum)
- Asymmetric encryption: RSA-4096 (preferred), RSA-2048 (minimum); ECDSA P-384 or higher preferred
- Hashing: SHA-256 (minimum), SHA-384 or SHA-512 preferred
- Key derivation: PBKDF2, bcrypt (cost factor 12+), or Argon2
- Deprecated and prohibited: DES, 3DES, RC4, MD5, SHA-1 (for digital signatures), RSA-1024 or smaller

3.2 Transport Layer Security (TLS)
- TLS 1.2 is the minimum required for all network communications involving Confidential or Restricted data.
- TLS 1.3 is preferred and must be enabled on all new systems.
- TLS 1.0 and 1.1 are prohibited and must be disabled on all systems.
- SSL (all versions) is prohibited.
- HTTP Strict Transport Security (HSTS) must be enabled on all public-facing web services.

4. DATA AT REST
4.1 All storage containing Confidential data must use full-disk encryption or volume-level encryption using AES-256.
4.2 All storage containing Restricted data must use AES-256 encryption with keys managed in an approved key management system.
4.3 Laptops and mobile devices with access to Confidential or Restricted data must have device-level encryption enabled (BitLocker, FileVault, or equivalent).
4.4 Database encryption must be implemented at the tablespace or column level for Restricted data fields.
4.5 Backup media must be encrypted to the same standard as the data it contains.

5. DATA IN TRANSIT
5.1 All Confidential and Restricted data must be encrypted during transmission using TLS 1.2 or higher.
5.2 API communications must use HTTPS exclusively; HTTP is prohibited for any data transmission.
5.3 Encrypted email (S/MIME or PGP) must be used when transmitting Restricted data via email.
5.4 Secure file transfer protocols (SFTP, FTPS, or HTTPS) must replace FTP for all file transfers.

6. KEY MANAGEMENT
6.1 Encryption keys must be managed in an approved Key Management System (KMS) or Hardware Security Module (HSM).
6.2 Key rotation must occur at minimum annually for standard keys; every 90 days for high-sensitivity keys.
6.3 Key material must never be stored in source code, configuration files, or logs.
6.4 Compromised or suspected-compromised keys must be revoked and rotated immediately.
6.5 Dual control and split knowledge must be applied to master keys and key encryption keys.

7. ROLES AND RESPONSIBILITIES
- Security Team: Define and maintain encryption standards, oversee key management.
- Engineering: Implement encryption controls in applications and infrastructure.
- IT: Enforce device encryption requirements.
- System Owners: Ensure systems under their ownership comply with this policy.

8. REVIEW
This policy will be reviewed annually or following significant changes to cryptographic standards, regulatory requirements, or upon any confirmed cryptographic weakness or key compromise.`,
  },
  {
    key: "audit-logging",
    title: "Audit Logging Policy",
    category: "security",
    description: "Requirements for system logging, log integrity, and log retention.",
    content: `AUDIT LOGGING POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes requirements for the collection, protection, and retention of audit logs to support security monitoring, incident investigation, and regulatory compliance.

2. SCOPE
This policy applies to all production systems, cloud environments, SaaS applications, network devices, and security tools operated by [Organization Name] that process, store, or transmit Confidential or Restricted data.

3. EVENTS REQUIRING LOGGING
All systems in scope must log at minimum:
- Authentication events: successful and failed login attempts, logouts, MFA events.
- Authorization events: access granted and denied, privilege escalation.
- Account management: user creation, modification, deletion, password changes.
- Data access: reads and writes to Restricted data records.
- System events: system startup, shutdown, configuration changes, software installation.
- Security events: firewall rule triggers, IDS/IPS alerts, malware detections.
- Administrative actions: all privileged operations.
- API access: all authenticated API calls including method, endpoint, and response code (not request bodies containing sensitive data).

4. LOG CONTENT REQUIREMENTS
Each log entry must include: timestamp (UTC), event type, source system, user or service account identifier, source IP address, outcome (success/failure), and sufficient context to reconstruct the event.
Logs must NOT contain: passwords, authentication tokens, encryption keys, or unredacted sensitive personal data (PII, PHI, financial data).

5. LOG PROTECTION AND INTEGRITY
5.1 Logs must be shipped to a centralized, tamper-evident log management system within 60 seconds of generation.
5.2 Log data must be protected against unauthorized modification or deletion; write access must be limited to log pipeline service accounts.
5.3 Log pipelines must be monitored for failures; gaps in log data must trigger alerts.
5.4 Logs for Restricted systems must be signed or hashed to detect tampering.

6. RETENTION REQUIREMENTS
- Standard logs: Minimum 1 year (12 months) with 90 days immediately accessible.
- Security event logs: Minimum 2 years (24 months) with 90 days immediately accessible.
- Logs required for regulatory compliance (HIPAA, PCI DSS, FedRAMP): Per applicable framework, minimum 3 years where required.
- All retention must comply with the Data Retention and Disposal Policy.

7. LOG REVIEW AND ALERTING
7.1 Security event logs must be reviewed daily; automated alerting must be configured for high-severity events.
7.2 Privileged account activity must be reviewed weekly.
7.3 A Security Information and Event Management (SIEM) or equivalent tool must aggregate and correlate logs from all in-scope systems.

8. ROLES AND RESPONSIBILITIES
- Security Team: Define logging requirements, operate SIEM, review security events.
- IT/Engineering: Implement log collection and forwarding on all systems.
- System Owners: Ensure systems under their ownership comply with logging requirements.
- Compliance: Validate log retention satisfies regulatory requirements.

9. REVIEW
This policy will be reviewed annually or following a security incident where log availability or integrity was a factor.`,
  },
  { key: "remote-work", title: "Remote Work Security Policy", category: "security", description: "Security requirements for remote and distributed workforce.", content: "[CUSTOMIZE] Update this template with your organization-specific VPN requirements, device management standards, home network guidance, and remote access approval process before publishing.\n\nKey areas to address:\n- Approved devices and MDM enrollment requirements\n- VPN usage requirements\n- Home network security standards\n- Physical security of work areas\n- Prohibited activities (public Wi-Fi without VPN, screen visibility in public)\n- Incident reporting while remote\n- Equipment loss/theft procedures" },
  { key: "vulnerability-management", title: "Vulnerability Management Policy", category: "security", description: "Process for identifying, prioritizing, and remediating vulnerabilities.", content: "[CUSTOMIZE] Update with your organization's scanning tools, scanning frequency, and SLA remediation timelines before publishing.\n\nKey areas to address:\n- Scanning scope and frequency (internal, external, container, cloud)\n- Severity classification (Critical/High/Medium/Low)\n- Remediation SLAs by severity (e.g., Critical: 15 days, High: 30 days)\n- Exception and risk acceptance process\n- Penetration testing requirements\n- Roles: Security team, system owners, engineering\n- Metrics and reporting cadence" },
  { key: "data-retention", title: "Data Retention & Disposal Policy", category: "data", description: "Rules for retaining, archiving, and securely disposing of data.", content: "[CUSTOMIZE] Update with your organization's specific retention schedules by data type and applicable regulatory requirements before publishing.\n\nKey areas to address:\n- Retention schedules by data classification and type (e.g., financial: 7 years, HR records: 5 years, system logs: 1-3 years)\n- Regulatory-mandated retention periods (HIPAA, PCI DSS, FedRAMP, etc.)\n- Legal hold procedures\n- Secure disposal methods by media type (NIST 800-88 compliance)\n- Third-party and cloud data deletion verification\n- Destruction certificate requirements for Restricted data" },
  { key: "physical-security", title: "Physical Security Policy", category: "operations", description: "Controls for physical access to facilities and hardware assets.", content: "[CUSTOMIZE] Update with your specific facility locations, access control systems, and visitor procedures before publishing.\n\nKey areas to address:\n- Physical access control systems (badge readers, biometrics, key cards)\n- Visitor management and escort requirements\n- Secure areas and data center access controls\n- CCTV/surveillance requirements and retention\n- Clean desk and screen lock requirements (reference Clean Desk Policy)\n- Tailgating and piggybacking prevention\n- Incident reporting for physical security breaches" },
  { key: "hr-security", title: "HR Security Policy", category: "hr", description: "Security requirements for hiring, onboarding, and offboarding personnel.", content: "[CUSTOMIZE] Update with your organization's background check providers, onboarding checklist, and offboarding procedures before publishing.\n\nKey areas to address:\n- Background check requirements by role level (criminal, employment verification, credit where applicable)\n- Security awareness training requirements before system access\n- Acceptable use and policy acknowledgment at onboarding\n- Confidentiality and NDA agreements\n- Role-based access provisioning process at hire\n- Offboarding checklist (account deprovisioning, device return, badge deactivation)\n- Disciplinary process for security violations" },
  { key: "third-party-access", title: "Third-Party Access Policy", category: "risk", description: "Requirements for granting and monitoring third-party system access.", content: "[CUSTOMIZE] Update with your specific contractor onboarding process, VPN or jump server requirements, and monitoring tools before publishing.\n\nKey areas to address:\n- Access request and approval process for contractors and vendors\n- Required agreements before access is provisioned (NDA, security addendum)\n- Technical controls for third-party access (VPN, jump hosts, session recording)\n- Scope limitations and time-bound access\n- Monitoring and audit requirements for third-party sessions\n- Termination procedures and access revocation timelines" },
  { key: "mobile-device", title: "Mobile Device & BYOD Policy", category: "security", description: "Rules for using personal and corporate mobile devices to access company data.", content: "[CUSTOMIZE] Update with your MDM platform name, enrollment requirements, and BYOD program scope before publishing.\n\nKey areas to address:\n- Approved device types and operating system versions\n- MDM enrollment requirements for corporate and BYOD devices\n- Required security configurations (PIN/biometric, encryption, screen lock timeout)\n- Approved apps and app store policies\n- Remote wipe capabilities and user consent\n- Lost/stolen device reporting and response\n- Data segregation between personal and corporate data on BYOD" },
  { key: "network-security", title: "Network Security Policy", category: "security", description: "Standards for network segmentation, firewalls, and secure connectivity.", content: "[CUSTOMIZE] Update with your network topology, firewall platforms, and segmentation architecture before publishing.\n\nKey areas to address:\n- Network segmentation principles (production, development, corporate, DMZ)\n- Firewall rule management (default-deny, change request process, review frequency)\n- Wireless network security standards (WPA3, guest network isolation)\n- VPN requirements for remote access\n- DNS security and filtering\n- Network monitoring and IDS/IPS requirements\n- Third-party and cloud network connectivity standards" },
  { key: "security-awareness", title: "Security Awareness Training Policy", category: "hr", description: "Requirements for annual security training and phishing simulations.", content: "[CUSTOMIZE] Update with your training platform, specific course requirements, and phishing simulation frequency before publishing.\n\nKey areas to address:\n- Mandatory training at onboarding (completion required before system access)\n- Annual security awareness training requirements\n- Role-based supplemental training (developers, privileged users, executives)\n- Phishing simulation frequency and failure response procedures\n- Training completion tracking and reporting\n- Consequences for non-completion\n- Metrics: completion rates, phishing simulation click rates, improvement targets" },
  { key: "ai-use", title: "AI & Generative AI Use Policy", category: "operations", description: "Guidelines for employee use of AI tools and handling of AI-generated content.", content: "[CUSTOMIZE] Update with your approved AI tools list, data classification restrictions, and output review requirements before publishing.\n\nKey areas to address:\n- Approved vs. prohibited AI tools and services\n- Data classification restrictions (what data may be entered into AI tools)\n- Output review requirements (AI-generated content must be reviewed before use)\n- Intellectual property and copyright considerations\n- Customer disclosure requirements for AI-generated content\n- Prohibited uses (legal filings, clinical decisions, security-critical code without review)\n- Vendor AI tool evaluation process" },
  { key: "cloud-security", title: "Cloud Security Policy", category: "security", description: "Controls for cloud infrastructure configuration, access, and monitoring.", content: "[CUSTOMIZE] Update with your specific cloud providers, approved services, and IaC tooling before publishing.\n\nKey areas to address:\n- Approved cloud service providers and service types\n- Infrastructure as Code (IaC) requirements and security scanning\n- Cloud access control and IAM requirements (least privilege, MFA)\n- Security baseline configurations by cloud service type\n- Cloud Security Posture Management (CSPM) tooling requirements\n- Data residency and sovereignty requirements\n- Prohibited configurations (public S3 buckets, unrestricted security groups, etc.)\n- Cloud cost and resource tagging requirements" },
  { key: "software-development", title: "Secure Software Development Policy", category: "operations", description: "Security requirements for SDLC, code review, and production deployments.", content: "[CUSTOMIZE] Update with your specific CI/CD tooling, SAST/DAST scanners, and deployment approval process before publishing.\n\nKey areas to address:\n- Threat modeling requirements for new features and significant changes\n- Mandatory code review before merging to main/production branches\n- SAST and DAST scanning requirements in CI/CD pipeline\n- Dependency scanning and vulnerability management (SCA)\n- Secrets management (no credentials in code, required use of secrets manager)\n- Pre-production and staging environment requirements\n- Production deployment approval process\n- Penetration testing requirements for public-facing features" },
  { key: "asset-management", title: "Asset Management Policy", category: "operations", description: "Inventory, classification, and lifecycle management of hardware and software assets.", content: "[CUSTOMIZE] Update with your asset inventory system, hardware refresh cycles, and software license management process before publishing.\n\nKey areas to address:\n- Asset inventory requirements (all hardware and software must be registered)\n- Asset classification by data sensitivity and criticality\n- Hardware asset lifecycle (procurement, deployment, maintenance, decommission)\n- Software asset lifecycle (approved software list, license management, end-of-life tracking)\n- Asset tagging and physical identification\n- Mobile device and endpoint registration requirements\n- Decommissioning procedures including secure data wiping" },
  { key: "privacy", title: "Privacy Policy (Internal)", category: "data", description: "Internal guidelines for handling personal data of employees and customers.", content: "[CUSTOMIZE] Update with your specific data categories, processing purposes, retention periods, and legal bases before publishing. Have Legal review before finalization.\n\nKey areas to address:\n- Categories of personal data collected and processed\n- Lawful basis for processing (consent, contract, legitimate interest, legal obligation)\n- Data subject rights (access, rectification, erasure, portability, objection)\n- Data subject request handling procedures and timelines (30 days under GDPR)\n- Cross-border data transfer mechanisms (SCCs, adequacy decisions)\n- Data breach notification process and timelines\n- Data Protection Officer (DPO) contact information if applicable\n- Retention periods by data category" },
  { key: "whistleblower", title: "Whistleblower & Ethics Policy", category: "hr", description: "Protections for employees reporting compliance violations or unethical conduct.", content: "[CUSTOMIZE] Update with your specific reporting channels, investigating authority, and applicable legal protections before publishing. Have Legal review before publishing.\n\nKey areas to address:\n- Scope of reportable conduct (fraud, safety violations, compliance breaches, legal violations)\n- Reporting channels (anonymous hotline, ethics email, direct manager, HR, legal)\n- Confidentiality protections for reporters\n- Anti-retaliation protections and enforcement\n- Investigation process and timelines\n- Documentation and record-keeping requirements\n- Reporting obligations to regulators where applicable" },
  { key: "clean-desk", title: "Clean Desk & Screen Lock Policy", category: "security", description: "Requirements for securing workstations and physical documents when unattended.", content: "[CUSTOMIZE] Update with your specific screen lock timeout settings and secure storage requirements before publishing.\n\nKey areas to address:\n- Screen lock requirements (automatic lock after X minutes, manual lock when leaving desk)\n- Clean desk requirements at end of day (no confidential documents, notebooks, or media visible)\n- Whiteboard clearing requirements in shared spaces\n- Secure storage requirements for physical documents (locked drawers/cabinets for Confidential and Restricted)\n- Printer security (retrieve documents immediately, no sensitive documents left in printer trays)\n- Visitor areas (no confidential information visible during visitor access)\n- Enforcement and consequences" },
  { key: "media-handling", title: "Removable Media Policy", category: "security", description: "Controls for use, encryption, and disposal of USB drives and external storage.", content: "[CUSTOMIZE] Update with your specific DLP controls and approved media list before publishing.\n\nKey areas to address:\n- Approved removable media types and prohibition of unapproved media\n- Encryption requirements for all removable media containing Confidential or Restricted data\n- DLP controls to prevent unauthorized data transfer via removable media\n- Tracking and inventory of authorized removable media\n- Prohibition of personal removable media on corporate systems\n- Lost or stolen media reporting and response\n- Secure disposal requirements (physical destruction for Restricted data)" },
  { key: "backup-recovery", title: "Backup & Recovery Policy", category: "operations", description: "Requirements for data backup frequency, offsite storage, and tested recovery.", content: "[CUSTOMIZE] Update with your specific backup tools, retention schedules, and RTO/RPO targets before publishing.\n\nKey areas to address:\n- Backup frequency requirements by system criticality (daily minimum for critical systems)\n- Retention schedules (daily, weekly, monthly, annual snapshots)\n- Offsite/offline backup requirements (at least one copy geographically separated)\n- Backup encryption requirements (same standard as source data)\n- Restoration testing frequency (quarterly minimum, annual full restore test)\n- Recovery Time Objective (RTO) and Recovery Point Objective (RPO) targets by system tier\n- Monitoring and alerting for backup failures\n- Roles: who is responsible for backup operations, monitoring, and testing" },
  { key: "patch-management", title: "Patch Management Policy", category: "security", description: "SLAs and procedures for applying OS, application, and firmware patches.", content: "[CUSTOMIZE] Update with your specific patch management tooling and SLA timelines before publishing.\n\nKey areas to address:\n- Patch scanning frequency (weekly minimum)\n- Severity-based remediation SLAs:\n  Critical: 15 days (or 72 hours for actively exploited)\n  High: 30 days\n  Medium: 90 days\n  Low: 180 days\n- Patch testing requirements (test in non-production before production)\n- Emergency patching process for zero-day vulnerabilities\n- End-of-life software handling (upgrade or compensating controls)\n- Exception and risk acceptance process\n- Metrics: patch compliance rate targets (Critical/High: 95%+)" },
  { key: "identity-management", title: "Identity & Access Management Policy", category: "security", description: "Standards for user provisioning, deprovisioning, SSO, and privileged accounts.", content: "[CUSTOMIZE] Update with your IdP platform, SSO configuration, and PAM tooling before publishing.\n\nKey areas to address:\n- Identity provider (IdP) requirements and SSO enforcement\n- Unique identifier requirements (one account per individual)\n- Provisioning workflow and approval requirements\n- Privileged account management (PAM) requirements\n- Service account standards (no human accounts as service accounts)\n- Dormant account detection and deactivation timelines\n- Role-based access control (RBAC) design principles\n- Federation and external identity standards" },
  { key: "configuration-management", title: "Configuration Management Policy", category: "operations", description: "Baseline hardening standards, secure configuration, and configuration drift controls.", content: "[CUSTOMIZE] Update with your specific hardening benchmarks and configuration management tooling before publishing.\n\nKey areas to address:\n- Hardening baseline standards by system type (CIS Benchmarks recommended)\n- Configuration management tooling (Ansible, Terraform, Chef, Puppet)\n- Approved base images and golden AMI/container image requirements\n- Configuration drift detection and remediation\n- Change management for configuration changes (reference Change Management Policy)\n- Separation of production and non-production configurations\n- Configuration audit frequency and tooling" },
  { key: "supply-chain-risk", title: "Supply Chain Risk Management Policy", category: "risk", description: "Controls for assessing and managing cybersecurity risk from software and hardware supply chains.", content: "[CUSTOMIZE] Update with your specific supplier assessment process and SBOM requirements before publishing. Required for CMMC and NIST 800-171.\n\nKey areas to address:\n- Software Bill of Materials (SBOM) requirements for critical software\n- Open source software risk assessment and approved usage\n- Hardware supplier security assessment requirements\n- Prohibited software and supplier lists\n- Contractual security requirements for suppliers\n- Incident notification requirements from suppliers\n- NIST 800-161 / CMMC SR domain control requirements (if applicable)" },
  { key: "contingency-planning", title: "Contingency Planning Policy", category: "risk", description: "Disaster recovery planning, system backup, and restoration procedures.", content: "[CUSTOMIZE] Update with your specific system tiers, RTO/RPO targets, and DR site information before publishing. Required for FedRAMP CP family controls.\n\nKey areas to address:\n- System criticality tiers and associated RTO/RPO requirements\n- Disaster recovery site (warm/cold/hot standby) requirements\n- Failover procedures for critical systems\n- Recovery procedures and runbooks\n- DR test frequency and types (tabletop, partial failover, full failover)\n- Alternate processing site requirements\n- Communication procedures during a disaster\n- FedRAMP CP control family requirements if applicable" },
  { key: "personnel-security", title: "Personnel Security Policy", category: "hr", description: "Background screening, clearance management, and personnel security procedures.", content: "[CUSTOMIZE] Update with your background check provider, screening levels by role, and clearance management process before publishing.\n\nKey areas to address:\n- Background screening requirements by role sensitivity level\n- Elements screened (criminal history, employment verification, education, credit where applicable)\n- Adjudication process for adverse findings\n- Security clearance management if applicable (government contractor)\n- Insider threat awareness and reporting\n- Personnel changes requiring re-screening\n- Third-party and contractor screening requirements\n- Record-keeping and privacy compliance" },
  { key: "security-authorization", title: "Security Assessment & Authorization Policy", category: "operations", description: "Governs the authorization of information systems to operate. Required for FedRAMP CA family controls.", content: "[CUSTOMIZE] Update with your ATO process, assessment methodology, and authorization authority before publishing. Required for FedRAMP and FISMA.\n\nKey areas to address:\n- System authorization lifecycle (assessment, authorization, continuous monitoring)\n- Authority to Operate (ATO) issuance and renewal process\n- Security assessment methodology and assessor qualifications\n- Security assessment report (SAR) requirements\n- Plan of Action and Milestones (POA&M) management\n- Continuous monitoring requirements and frequency\n- Significant change assessment requirements\n- FedRAMP CA control family requirements if applicable" },
  { key: "api-security", title: "API Security Policy", category: "security", description: "Security standards for API design, authentication, rate limiting, and versioning.", content: "[CUSTOMIZE] Update with your specific API gateway platform, authentication standards, and versioning policy before publishing.\n\nKey areas to address:\n- Authentication requirements (OAuth 2.0, API keys, JWT standards)\n- Rate limiting requirements by API tier\n- Input validation and output encoding requirements\n- OWASP API Security Top 10 adherence requirements\n- API versioning and deprecation standards\n- API inventory and documentation requirements\n- Penetration testing requirements for public APIs\n- Third-party API integration security review process" },
  { key: "responsible-disclosure", title: "Responsible Disclosure & Bug Bounty Policy", category: "security", description: "Process for external researchers to report security vulnerabilities.", content: "[CUSTOMIZE] Update with your reporting contact, scope definition, response timelines, and any bounty program details before publishing.\n\nKey areas to address:\n- How to report a vulnerability (security contact email, HackerOne, or similar)\n- Scope: in-scope and out-of-scope systems and vulnerability types\n- Response timeline commitments (acknowledgment within 24-48 hours)\n- Safe harbor provisions (researchers acting in good faith will not face legal action)\n- Remediation timeline targets by severity\n- Disclosure coordination process and timeline\n- Recognition program (hall of fame, monetary rewards if applicable)\n- What is NOT allowed (DoS, social engineering, physical attacks)" },
  { key: "zero-trust", title: "Zero Trust Architecture Policy", category: "security", description: "Governs implementation of never-trust-always-verify network access and identity verification principles.", content: "[CUSTOMIZE] Update with your specific zero trust tooling and implementation roadmap before publishing.\n\nKey areas to address:\n- Zero trust principles (verify explicitly, use least privilege, assume breach)\n- Identity verification requirements (MFA, continuous authentication)\n- Device health verification requirements\n- Network micro-segmentation approach\n- Application access control (identity-aware proxy, ZTNA)\n- Data protection and DLP integration\n- Monitoring and anomaly detection requirements\n- Migration path from perimeter-based security" },
  { key: "cookie-consent", title: "Cookie & Consent Management Policy", category: "data", description: "Cookie categories, consent banner requirements, and user rights under GDPR and CCPA.", content: "[CUSTOMIZE] Update with your specific cookie categories, consent management platform, and applicable jurisdictions before publishing. Have Legal review before publishing.\n\nKey areas to address:\n- Cookie categories (strictly necessary, functional, analytics, marketing/advertising)\n- Consent requirements by jurisdiction (GDPR opt-in, CCPA opt-out)\n- Consent management platform (CMP) requirements\n- Cookie banner design and consent recording requirements\n- Third-party cookie and pixel inventory\n- Data retention for cookie consent records\n- User rights: withdrawing consent, accessing cookie data\n- Annual cookie audit requirements" },
  { key: "iot-security", title: "IoT & OT Security Policy", category: "security", description: "Security controls for Internet of Things and Operational Technology devices.", content: "[CUSTOMIZE] Update with your specific IoT device inventory, network segmentation approach, and applicable industry standards before publishing.\n\nKey areas to address:\n- IoT/OT device inventory and classification\n- Network isolation requirements (separate VLANs for IoT devices)\n- Default credential change requirements\n- Firmware update and patch management for IoT devices\n- Monitoring and anomaly detection for IoT networks\n- Physical security for OT environments\n- Vendor security requirements for IoT device procurement\n- Incident response considerations specific to OT environments" },
  { key: "board-cybersecurity", title: "Board-Level Cybersecurity Governance Policy", category: "operations", description: "CISO reporting cadence, board oversight of cyber risk, and governance structure.", content: "[CUSTOMIZE] Update with your organization's board structure, reporting cadence, and applicable governance frameworks (SOX, DORA, etc.) before publishing.\n\nKey areas to address:\n- Board cybersecurity oversight responsibilities\n- CISO reporting cadence to board (quarterly minimum)\n- Cybersecurity metrics to be reported (risk posture, incident summary, program maturity)\n- Board member cybersecurity education requirements\n- Cyber risk appetite statement and approval process\n- Significant incident escalation to board requirements\n- Cyber risk in enterprise risk management (ERM) integration\n- SEC cybersecurity disclosure considerations (for public companies)\n- DORA governance requirements if applicable" },,
  {
    key: "mfa-policy",
    title: "Multi-Factor Authentication Policy",
    category: "security",
    description: "Requires MFA for access to systems and establishes authentication standards.",
    frameworks: ["CMMC", "FedRAMP", "SOC2", "NIST800-53"],
    content: "MFA POLICY PLACEHOLDER",
  },
  {
    key: "privileged-access",
    title: "Privileged Access Management Policy",
    category: "security",
    description: "Controls provisioning, use, and monitoring of privileged and administrative accounts.",
    frameworks: ["CMMC", "FedRAMP", "SOC2", "ISO27001"],
    content: "PAM POLICY PLACEHOLDER",
  },
  {
    key: "endpoint-security",
    title: "Endpoint Security Policy",
    category: "security",
    description: "Requirements for securing workstations, laptops, mobile devices, and servers.",
    frameworks: ["CMMC", "SOC2", "ISO27001"],
    content: "ENDPOINT POLICY PLACEHOLDER",
  },
  {
    key: "data-breach-response",
    title: "Data Breach Response Policy",
    category: "security",
    description: "Procedures for detecting, containing, and notifying from data breaches.",
    frameworks: ["SOC2", "GDPR", "CCPA"],
    content: "BREACH RESPONSE PLACEHOLDER",
  },
  {
    key: "secure-communications",
    title: "Secure Communications Policy",
    category: "security",
    description: "Requirements for encrypted and secure transmission of organizational data.",
    frameworks: ["CMMC", "FedRAMP", "SOC2"],
    content: "SECURE COMMS PLACEHOLDER",
  },
  {
    key: "risk-assessment",
    title: "Risk Assessment Policy",
    category: "compliance",
    description: "Framework for identifying, assessing, and treating organizational risk.",
    frameworks: ["ISO27001", "NIST-CSF", "FedRAMP", "SOC2"],
    content: "RISK ASSESSMENT PLACEHOLDER",
  },
  {
    key: "cmmc-compliance",
    title: "CMMC Compliance Policy",
    category: "federal",
    description: "Policy establishing requirements for CMMC Level 2/3 compliance for DoD contractors.",
    frameworks: ["CMMC", "NIST800-171", "DFARS"],
    content: "CMMC COMPLIANCE PLACEHOLDER",
  },
  {
    key: "fedramp-compliance",
    title: "FedRAMP Compliance Policy",
    category: "federal",
    description: "Policy for achieving and maintaining FedRAMP authorization for cloud services.",
    frameworks: ["FedRAMP", "NIST800-53", "FISMA"],
    content: "FEDRAMP COMPLIANCE PLACEHOLDER",
  }
];

@Injectable()
export class PoliciesService {
  getTemplates() {
    return { templates: POLICY_TEMPLATES };
  }

  async getOrgPolicies(orgId: number) {
    const policies = await db.query.orgPoliciesTable.findMany({
      where: eq(orgPoliciesTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const ackCounts = await Promise.all(
      policies.map(async (p) => {
        const acks = await db.query.orgPolicyAcknowledgmentsTable.findMany({
          where: eq(orgPolicyAcknowledgmentsTable.policyId, p.id),
        });
        return { policyId: p.id, count: acks.length };
      }),
    );
    const ackMap = new Map(ackCounts.map((a) => [a.policyId, a.count]));
    return {
      policies: policies.map((p) => ({
        ...p,
        acknowledgedCount: ackMap.get(p.id) ?? 0,
        lastReviewedAt: (p as any).last_reviewed_at ?? null,
        version: (p as any).version ?? "1.0",
      })),
    };
  }

  async createPolicy(orgId: number, body: Record<string, unknown>) {
    const [policy] = await db.insert(orgPoliciesTable).values({ orgId, ...body } as any).returning();
    await writeAuditLog(orgId, "policy.created", "policy", String(policy.id), { title: policy.title, status: policy.status });
    return { policy };
  }

  async updatePolicy(orgId: number, id: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.status === "published") {
      updates.publishedAt = new Date();
    }
    const [policy] = await db
      .update(orgPoliciesTable)
      .set(updates)
      .where(and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)))
      .returning();
    const action = body.status === "published" ? "policy.published" : "policy.updated";
    await writeAuditLog(orgId, action, "policy", String(id), { title: policy?.title, status: policy?.status });
    return { policy };
  }

  async deletePolicy(orgId: number, id: number) {
    await db
      .delete(orgPoliciesTable)
      .where(and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)));
    await writeAuditLog(orgId, "policy.deleted", "policy", String(id));
    return { success: true };
  }

  async getAcknowledgments(orgId: number, policyId: number) {
    const acks = await db.query.orgPolicyAcknowledgmentsTable.findMany({
      where: and(
        eq(orgPolicyAcknowledgmentsTable.orgId, orgId),
        eq(orgPolicyAcknowledgmentsTable.policyId, policyId),
      ),
    });
    const people = await db.query.orgPeopleTable.findMany({
      where: eq(orgPeopleTable.orgId, orgId),
    });
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    return {
      acknowledgments: acks.map((a) => ({
        ...a,
        person: peopleMap.get(a.personId) ?? null,
      })),
      total: people.length,
      acknowledged: acks.length,
      pending: Math.max(0, people.length - acks.length),
    };
  }

  async acknowledgePolicy(orgId: number, policyId: number, body: { personId: number; ipAddress?: string }) {
    const existing = await db.query.orgPolicyAcknowledgmentsTable.findFirst({
      where: and(
        eq(orgPolicyAcknowledgmentsTable.orgId, orgId),
        eq(orgPolicyAcknowledgmentsTable.policyId, policyId),
        eq(orgPolicyAcknowledgmentsTable.personId, body.personId),
      ),
    });
    if (existing) return { acknowledgment: existing, alreadyAcknowledged: true };

    const [ack] = await db.insert(orgPolicyAcknowledgmentsTable).values({
      orgId,
      policyId,
      personId: body.personId,
      ipAddress: body.ipAddress,
    }).returning();
    await writeAuditLog(orgId, "policy.acknowledged", "policy", String(policyId), { personId: body.personId });
    return { acknowledgment: ack, alreadyAcknowledged: false };
  }

  async bulkRequestAcknowledgment(orgId: number, policyId: number) {
    const policy = await db.query.orgPoliciesTable.findFirst({
      where: and(eq(orgPoliciesTable.id, policyId), eq(orgPoliciesTable.orgId, orgId)),
    });
    if (!policy) return { success: false };
    const people = await db.query.orgPeopleTable.findMany({
      where: and(eq(orgPeopleTable.orgId, orgId), eq(orgPeopleTable.active, true)),
    });
    await writeAuditLog(orgId, "policy.ack_requested", "policy", String(policyId), { title: policy.title, recipients: people.length });
    return { requested: people.length, policy };
  }

  async getPolicyReviews(orgId: number, policyId: number) {
    await this.ensurePolicyReviewsTable();
    const rows = await db.execute(
      sql\`SELECT * FROM org_policy_reviews WHERE org_id = \${orgId} AND policy_id = \${policyId} ORDER BY reviewed_at DESC LIMIT 50\`
    );
    return { reviews: rows.rows ?? rows };
  }

  async reviewPolicy(orgId: number, id: number, body: { notes?: string; bumpVersion?: boolean }) {
    await this.ensurePolicyReviewsTable();
    const existing = await db.query.orgPoliciesTable.findFirst({
      where: and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)),
    });
    if (!existing) throw new Error("Policy not found");
    const currentVersion = String((existing as any).version ?? "1.0");
    let newVersion = currentVersion;
    if (body.bumpVersion) {
      const parts = currentVersion.split(".");
      const minor = parseInt(parts[1] ?? "0", 10) + 1;
      newVersion = \`\${parts[0]}.\${minor}\`;
    }
    const now = new Date();
    await db.execute(
      sql\`UPDATE org_policies SET status = 'published', last_reviewed_at = \${now}, version = \${newVersion}, updated_at = \${now} WHERE id = \${id} AND org_id = \${orgId}\`
    );
    await db.execute(
      sql\`INSERT INTO org_policy_reviews (org_id, policy_id, notes, version_before, version_after, reviewed_at) VALUES (\${orgId}, \${id}, \${body.notes ?? null}, \${currentVersion}, \${newVersion}, \${now})\`
    );
    await writeAuditLog(orgId, "policy.reviewed", "policy", String(id), { title: existing.title, version: newVersion, notes: body.notes });
    return { success: true, version: newVersion, reviewedAt: now };
  }

  private async ensurePolicyReviewsTable() {
    await db.execute(sql\`
      CREATE TABLE IF NOT EXISTS org_policy_reviews (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL,
        policy_id INTEGER NOT NULL,
        notes TEXT,
        version_before TEXT,
        version_after TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    \`);
  }

}
