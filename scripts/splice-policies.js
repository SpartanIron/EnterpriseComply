#!/usr/bin/env node
/**
 * Splice full policy content into policies.service.ts, replacing all stubs/placeholders.
 * Run from workspace root: node scripts/splice-policies.js
 */
const fs = require("fs");

const POLICIES = [
  {
    key: "remote-work",
    title: "Remote Work Security Policy",
    category: "security",
    description: "Security requirements for remote and distributed employees accessing organizational systems from outside corporate facilities.",
    content: `REMOTE WORK SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for employees, contractors, and consultants who access organizational systems, applications, and data from remote locations. Remote work introduces security risks that must be managed to protect organizational and client data.

2. SCOPE
This policy applies to all personnel who access [Organization Name] systems, applications, or data from any location outside a managed corporate facility, including home offices, co-working spaces, hotels, and public locations.

3. APPROVED DEVICES
3.1 Only organization-approved or formally enrolled BYOD devices may be used to access organizational systems.
3.2 All devices must be enrolled in the organization's Mobile Device Management (MDM) solution before accessing organizational resources.
3.3 Personal devices must meet the same security baseline as corporate devices: full disk encryption, screen lock, up-to-date OS and security patches, and approved endpoint protection software.
3.4 Using shared, borrowed, or public computers (e.g., hotel kiosks, library computers) to access organizational systems is prohibited.

4. NETWORK SECURITY
4.1 Employees must use the organization's VPN whenever accessing internal systems or Confidential/Restricted data from a non-corporate network.
4.2 Public Wi-Fi networks (coffee shops, airports, hotels) must never be used to access organizational systems without an active VPN connection.
4.3 Home networks should use WPA3 or WPA2 encryption. Employees are responsible for securing their home router with a strong password and disabling remote management.
4.4 Split tunneling that routes organizational traffic outside the VPN is prohibited without explicit IT approval.

5. PHYSICAL SECURITY
5.1 Employees must ensure that unauthorized individuals (including family members) cannot view screens displaying organizational or client data.
5.2 Devices must be locked (screen lock) whenever unattended, even briefly.
5.3 Confidential printed documents must be stored securely and shredded when no longer needed - not placed in household recycling.
5.4 Devices must not be left unattended in vehicles, public spaces, or locations accessible to unauthorized persons.
5.5 Theft or loss of any device used to access organizational data must be reported to IT within 1 hour of discovery.

6. SOFTWARE AND CONFIGURATION
6.1 Installation of unauthorized software on MDM-enrolled devices requires IT approval.
6.2 OS and security patches must be applied within the timeframes defined in the Patch Management Policy.
6.3 Cloud sync applications (e.g., personal Dropbox, iCloud) must not be configured to sync organizational data.
6.4 Personal email accounts must not be used to send or receive organizational data.

7. COMMUNICATION AND COLLABORATION
7.1 Organizational communication and collaboration must occur through approved platforms (e.g., approved email, Slack, Teams).
7.2 Video calls discussing Confidential or Restricted information must be conducted in private settings where the audio cannot be overheard by unauthorized individuals.

8. INCIDENT REPORTING
Any suspected security incident while working remotely - including lost/stolen devices, unusual account behavior, or suspected phishing - must be reported immediately to the security team.

9. ROLES AND RESPONSIBILITIES
- Employees: Comply with all requirements; report incidents immediately.
- IT/Security: Maintain MDM, VPN, and remote access infrastructure; respond to incidents.
- Managers: Ensure team members complete remote work security training.

10. ENFORCEMENT
Non-compliance may result in immediate suspension of remote access privileges and disciplinary action up to termination.

Policy Owner: [CISO / Security Lead]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "vulnerability-management",
    title: "Vulnerability Management Policy",
    category: "security",
    description: "Process for identifying, prioritizing, and remediating vulnerabilities across infrastructure, applications, and cloud environments. Satisfies CMMC SI.1.210, FedRAMP RA-5, SOC 2 CC7.1.",
    content: `VULNERABILITY MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for the systematic identification, classification, remediation, and tracking of security vulnerabilities across all systems and applications operated by [Organization Name]. Effective vulnerability management is required by CMMC SI.1.210/SI.2.214, FedRAMP RA-5, and SOC 2 CC7.1.

2. SCOPE
This policy applies to all systems, applications, cloud infrastructure, containers, and network devices within the [Organization Name] authorization boundary, including development, staging, and production environments.

3. SCANNING REQUIREMENTS
3.1 All production infrastructure and applications must be scanned for vulnerabilities at minimum:
- Internal/infrastructure scanning: Weekly
- External/internet-facing scanning: Monthly
- Container image scanning: On every build (CI/CD pipeline integration)
- Cloud configuration scanning (CSPM): Continuous
3.2 Scanning must cover: operating systems, installed software, open network ports, web application vulnerabilities (OWASP Top 10), cloud misconfigurations, and container base images.
3.3 Authenticated scans are required for internal systems where technically feasible.
3.4 Vulnerability scan credentials must be protected as privileged secrets and rotated quarterly.

4. SEVERITY CLASSIFICATION
[Organization Name] uses the CVSS v3.x severity scale:
- Critical (CVSS 9.0-10.0): Immediate threat; typically involves remote code execution, active exploitation, or complete system compromise.
- High (CVSS 7.0-8.9): Significant threat; may enable unauthorized access or escalation of privilege.
- Medium (CVSS 4.0-6.9): Moderate threat; exploitation typically requires conditions, privileges, or user interaction.
- Low (CVSS 0.1-3.9): Minimal direct threat but should be addressed to reduce attack surface.

5. REMEDIATION SLAs
All discovered vulnerabilities must be remediated or formally risk-accepted within the following timeframes from the date of discovery:
- Critical: 15 calendar days (72 hours if actively exploited in the wild)
- High: 30 calendar days
- Medium: 90 calendar days
- Low: 180 calendar days

Remediation includes patching, configuration change, compensating control implementation, or formal risk acceptance approved by the CISO.

6. TRACKING AND REPORTING
6.1 All vulnerabilities must be tracked in the organization's vulnerability management tool or risk register until closed.
6.2 Vulnerability status must be reported to the CISO monthly and to executive leadership quarterly.
6.3 Overdue vulnerabilities (past SLA) must be escalated to the CISO within 5 business days of SLA expiration.
6.4 All vulnerability findings and remediation evidence must be uploaded to the relevant UCO control in EnterpriseComply.

7. PENETRATION TESTING
7.1 External penetration testing by a qualified third-party firm must be conducted at minimum annually.
7.2 Application penetration testing of significant new features or services must occur before production release.
7.3 Penetration test reports and remediation evidence must be retained for 3 years and uploaded to Evidence Vault.

8. EXCEPTIONS AND RISK ACCEPTANCE
Vulnerabilities that cannot be remediated within SLA require written risk acceptance from the CISO. Risk acceptances must include: vulnerability identifier, business justification, compensating controls, and a re-evaluation date no more than 90 days in the future.

9. ROLES AND RESPONSIBILITIES
- Security Team: Own scanning operations, report findings, track SLAs.
- System Owners: Remediate vulnerabilities within their systems per SLA.
- CISO: Approve risk acceptances; escalation authority.
- Engineering: Integrate security scanning into CI/CD pipelines.

10. ENFORCEMENT
Failure to remediate within SLA without approved risk acceptance may result in the affected system being isolated from production until the vulnerability is resolved.

Policy Owner: [CISO / Security Lead]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "data-retention",
    title: "Data Retention & Disposal Policy",
    category: "data",
    description: "Retention schedules by data type, legal hold procedures, and secure disposal requirements per NIST 800-88.",
    content: `DATA RETENTION & DISPOSAL POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes retention schedules for organizational data and secure disposal procedures for data that has exceeded its retention period. Proper retention ensures compliance with legal obligations and framework requirements; secure disposal prevents unauthorized access to sensitive data after retention periods expire.

2. SCOPE
This policy applies to all data created, received, stored, or processed by [Organization Name], in all formats (electronic, physical) and in all locations (on-premises, cloud, third-party processors, backups).

3. DATA RETENTION SCHEDULES
3.1 By Data Classification:

RESTRICTED / CUI (Controlled Unclassified Information):
- Audit logs and access records: 3 years (CMMC AU.3.045 / FedRAMP AU-11 minimum)
- Security incident records: 5 years
- CUI itself: Per the CUI handling requirements of the applicable federal contract

CONFIDENTIAL:
- Financial records and contracts: 7 years
- HR records (employment, performance, termination): 7 years
- Customer contracts and data processing records: Duration of relationship + 5 years
- Security assessment reports and pen test results: 3 years
- Evidence Vault artifacts: 3 years after framework observation period

INTERNAL:
- General business records and email: 3 years
- System logs (non-security): 1 year
- Project documentation: 3 years after project closure

PUBLIC:
- Marketing materials and published documents: Duration of relevance

3.2 Legal, regulatory, or contractual requirements that mandate longer retention periods supersede this schedule. The legal team must be consulted before destroying any record subject to potential litigation, regulatory inquiry, or active investigation.

4. LEGAL HOLD
4.1 When litigation, regulatory investigation, or audit is anticipated or initiated, a Legal Hold is issued by Legal/Compliance.
4.2 Legal Holds suspend all retention-based disposal for data within the hold scope.
4.3 System owners and data custodians must acknowledge and comply with Legal Hold notices within 24 hours.
4.4 Legal Holds remain in effect until formally released in writing.

5. DATA DISPOSAL AND DESTRUCTION
5.1 Electronic media must be disposed of per NIST SP 800-88 Guidelines for Media Sanitization:
- Internal use only / Public data: Clear (overwrite using approved software, minimum DoD 5220.22-M 3-pass)
- Confidential / Restricted data: Purge (cryptographic erasure for encrypted media or NIST-compliant overwrite) or Physical Destruction
- Destroyed media must not be reused in production systems

5.2 Physical documents containing Confidential or Restricted information must be shredded using cross-cut or micro-cut shredders. Strip-cut shredding is not acceptable for Restricted data.

5.3 Cloud data deletion must be confirmed via provider tools or API response and documented. Verify that data is removed from all backups, caches, and replicas within the cloud provider's stated deletion timeframe.

5.4 Third-party processors must be required via contract to return or destroy organizational data within 30 days of contract termination and provide written certification.

5.5 Media destruction must be documented: record the date, media type and identifier, destruction method, and the name of the person who performed or witnessed destruction.

6. ROLES AND RESPONSIBILITIES
- Data Owners: Classify data and ensure retention schedules are applied.
- IT/Security: Implement technical controls for retention and disposal.
- Legal/Compliance: Manage legal holds; advise on regulatory obligations.
- All Employees: Follow disposal procedures; not circumvent retention controls.

7. ENFORCEMENT
Unauthorized destruction of data subject to a retention obligation or Legal Hold is a serious violation that may result in disciplinary action and personal legal liability.

Policy Owner: [CISO / Data Protection Officer]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "physical-security",
    title: "Physical Security Policy",
    category: "operations",
    description: "Controls for physical access to facilities, data centers, and hardware assets.",
    content: `PHYSICAL SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for physical security controls to protect [Organization Name] facilities, equipment, and the data they contain from unauthorized physical access, damage, theft, and natural or man-made disasters.

2. SCOPE
This policy applies to all [Organization Name] facilities, co-location facilities, cloud data centers used by the organization, and all corporate-owned or managed hardware assets.

3. FACILITY ACCESS CONTROLS
3.1 Physical access to facilities hosting organizational systems must be controlled by electronic access control systems (badge readers, key cards, or biometric readers).
3.2 Access rights must be provisioned on a least-privilege basis and reviewed quarterly.
3.3 Access rights must be immediately revoked upon employee or contractor termination.
3.4 Visitor access must be logged (visitor name, host, purpose, entry/exit time) and all visitors must be escorted by an authorized employee at all times in secure areas.
3.5 Tailgating (following an authorized person through a controlled door without presenting credentials) is prohibited. Employees are expected to challenge or report tailgating incidents.

4. SECURE AREAS
4.1 Server rooms, network closets, and other areas housing critical infrastructure must have reinforced access controls (secondary authentication, biometric, or key lock) in addition to general facility controls.
4.2 Access to secure areas must be limited to personnel whose job functions require it.
4.3 All access to secure areas must be logged and reviewed monthly.
4.4 No food, drink, or open containers are permitted in server rooms or network closets.

5. CCTV AND MONITORING
5.1 Facilities processing Confidential or Restricted data must maintain CCTV coverage of entry/exit points and server room access points.
5.2 CCTV footage must be retained for a minimum of 90 days.
5.3 CCTV systems must be monitored for tampering or failure; alerts must be configured for camera outages.

6. HARDWARE ASSET SECURITY
6.1 All hardware assets must be inventoried and tagged with a unique identifier.
6.2 Portable devices (laptops, external drives, USB devices) containing Confidential or Restricted data must be encrypted per the Encryption Policy.
6.3 Hardware assets must not be removed from secured facilities without documented approval from IT management.
6.4 Decommissioned hardware must be sanitized per the Data Retention & Disposal Policy before disposal, reuse, or donation.

7. ENVIRONMENTAL CONTROLS
7.1 Facilities housing critical systems must have appropriate environmental controls including: temperature and humidity monitoring, fire suppression systems, UPS (uninterruptible power supply) for critical systems, and surge protection.
7.2 Environmental monitoring alerts must be configured and tested quarterly.

8. ROLES AND RESPONSIBILITIES
- Facilities Management: Implement and maintain physical access controls, CCTV, and environmental systems.
- IT/Security: Manage hardware asset inventory; ensure decommission procedures are followed.
- All Employees: Report unauthorized access attempts, tailgating, or missing equipment.

9. ENFORCEMENT
Unauthorized physical access, tailgating, or failure to report security incidents may result in disciplinary action up to termination and referral to law enforcement.

Policy Owner: [CISO / Facilities Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "hr-security",
    title: "HR Security Policy",
    category: "hr",
    description: "Security requirements for pre-employment screening, onboarding, role changes, and offboarding of personnel.",
    content: `HR SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements throughout the employee lifecycle - from pre-hire screening through onboarding, role changes, and offboarding - to protect organizational systems and data and ensure only appropriately vetted individuals have access.

2. SCOPE
This policy applies to all employees, contractors, consultants, and temporary workers of [Organization Name]. Requirements apply equally to direct hires and individuals provided by staffing agencies.

3. PRE-EMPLOYMENT SCREENING
3.1 All candidates offered employment in roles with access to Confidential or Restricted data must successfully complete a background check before starting. Background check elements by role:
- All roles: Criminal history check (7-year lookback), employment verification (3 prior employers), education verification for claimed degrees.
- Roles with financial system access or handling of client funds: Credit history check.
- Roles with access to federal systems or CUI: Identity verification and eligibility screening per applicable federal requirements.
3.2 Background check results are reviewed by HR and the hiring manager. Adverse findings do not automatically disqualify a candidate but require documented adjudication.
3.3 Contractors and consultants provided by third-party agencies must have completed equivalent screening at the agency level. Written confirmation from the agency is required before access is granted.

4. ONBOARDING
4.1 Access provisioning must follow the principle of least privilege. New hires receive only the access required for their initial role, not the maximum available to their job category.
4.2 Before being granted system access, all new personnel must:
- Complete the security awareness training module (minimum 60-minute baseline training)
- Sign the Acceptable Use Policy acknowledgment
- Sign the Confidentiality and Non-Disclosure Agreement
- Sign acknowledgment of the Information Security Policy
4.3 MFA must be enrolled before any system access is granted. See the MFA Policy for enrollment requirements.
4.4 A unique user account must be created for each individual; shared accounts are prohibited.

5. ROLE CHANGES
5.1 When an employee changes roles, access rights must be adjusted within 5 business days: new role access provisioned and old role access revoked.
5.2 Promotions to privileged roles (administrator, CISO, system owner) require manager approval and documentation in the Privileged Accounts Register.
5.3 Access reviews triggered by significant role changes must be completed before the new access is provisioned.

6. OFFBOARDING
6.1 Upon notice of separation (voluntary or involuntary), HR must notify IT immediately.
6.2 For involuntary terminations: all system access must be revoked within 1 hour of notification. Physical access (badge) must be collected at the time of termination.
6.3 For voluntary terminations: all access must be revoked by end of the last day of employment.
6.4 Corporate devices must be returned and wiped within 5 business days of separation.
6.5 The offboarding checklist must be completed and documented: account deprovisioning confirmation, device return, badge deactivation, and reminder of ongoing confidentiality obligations.

7. CONFIDENTIALITY OBLIGATIONS
All personnel must be reminded at offboarding that confidentiality obligations established at onboarding survive the employment relationship and that disclosure of trade secrets, client data, or proprietary information may result in legal action.

8. ROLES AND RESPONSIBILITIES
- HR: Manage the onboarding/offboarding process; coordinate with IT for timely access changes.
- IT/Security: Provision and deprovision access; execute the offboarding checklist.
- Hiring Managers: Confirm role access requirements; participate in adjudication of adverse findings.

9. ENFORCEMENT
Failure to complete required onboarding training or sign required acknowledgments before system access is granted is a violation of this policy. Failure to return corporate devices or cooperate with offboarding procedures may result in legal action.

Policy Owner: [HR Director / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "third-party-access",
    title: "Third-Party Access Policy",
    category: "risk",
    description: "Requirements for granting, monitoring, and revoking third-party and contractor access to organizational systems.",
    content: `THIRD-PARTY ACCESS POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy governs the granting, management, and revocation of access to [Organization Name] systems, networks, and data by third-party entities including vendors, contractors, consultants, managed service providers, and business partners. Third-party access represents elevated risk due to reduced organizational control over third-party security practices.

2. SCOPE
This policy applies to all external entities that are granted any form of access to organizational systems, applications, networks, or data - including remote access, VPN access, API access, and physical access to facilities.

3. PRE-ACCESS REQUIREMENTS
3.1 Before any access is provisioned, the following must be completed:
- A signed Non-Disclosure Agreement (NDA) / Confidentiality Agreement
- A signed Third-Party Security Addendum or Data Processing Agreement (if third party will process personal data)
- A completed Third-Party Risk Assessment (see Risk Assessment Policy)
- Manager and IT approval of the access request
3.2 Third parties handling Restricted or CUI data must provide evidence of equivalent security controls (SOC 2 report, ISO 27001 certification, or completed security questionnaire within the last 12 months).
3.3 Third-party staff who will access Restricted data must complete [Organization Name]'s security awareness training or provide evidence of equivalent training at their organization.

4. ACCESS PROVISIONING
4.1 Third-party access must be provisioned on a least-privilege basis - access to the minimum data and systems necessary for the contracted purpose only.
4.2 Shared accounts for third-party access are prohibited. Each individual third-party user must have a unique account.
4.3 All third-party access must be time-bound: access expiration dates must be set at provisioning, aligned to contract duration but not to exceed 12 months without re-approval.
4.4 Third-party access must be documented in the access register, including: vendor name, individual name, access type, systems accessed, business justification, approver, and expiration date.

5. TECHNICAL CONTROLS FOR THIRD-PARTY ACCESS
5.1 Third-party remote access must occur via the organization's VPN or a dedicated secure remote access solution (e.g., jump server, identity-aware proxy).
5.2 Third-party access to production systems must use MFA.
5.3 Where technically feasible, third-party sessions accessing sensitive systems must be recorded and logs retained for 1 year.
5.4 Third parties must not be granted persistent privileged access. Just-in-time (JIT) or time-limited elevated access is preferred for privileged operations.
5.5 API access granted to third parties must use scoped API keys or OAuth tokens; credentials must be rotated quarterly or upon contract termination.

6. MONITORING
6.1 Third-party access activity must be included in the organization's access log monitoring.
6.2 Unusual access patterns (off-hours access, large data transfers, access to unexpected systems) must generate alerts.
6.3 A quarterly review of all active third-party access must be performed; unused access must be revoked.

7. REVOCATION
7.1 Access must be revoked within 24 hours of: contract termination, completion of the contracted work, or any security incident involving the third party.
7.2 IT must maintain an offboarding process for third parties equivalent to the employee offboarding process.

8. ROLES AND RESPONSIBILITIES
- Business Owner: Initiate third-party access requests; own the business relationship.
- IT/Security: Provision and monitor access; conduct quarterly access reviews.
- Procurement/Legal: Ensure contractual security requirements are in place.
- Third-Party Manager: Notify IT promptly when third-party individuals leave the vendor organization.

9. ENFORCEMENT
Granting third-party access without completing pre-access requirements is a policy violation. Third parties who violate access terms will have access immediately revoked and may face contractual penalties.

Policy Owner: [CISO / Procurement Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "mobile-device",
    title: "Mobile Device & BYOD Policy",
    category: "security",
    description: "Security requirements for corporate and employee-owned devices accessing organizational data, including MDM enrollment, encryption, and acceptable use.",
    content: `MOBILE DEVICE & BYOD POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for corporate-owned mobile devices and personally-owned devices (BYOD - Bring Your Own Device) that access [Organization Name] systems, email, or data. Mobile devices represent a significant risk vector due to their portability, connectivity, and exposure to physical loss.

2. SCOPE
This policy applies to all smartphones, tablets, and laptops - both corporate-owned and personally-owned - used to access [Organization Name] email, applications, or data.

3. DEVICE CATEGORIES AND APPROVAL
3.1 Corporate-owned devices: Issued and fully managed by IT. All policies apply without exception.
3.2 BYOD devices: Personally-owned devices approved for limited organizational use. BYOD is permitted for email and approved productivity applications only. BYOD devices must not be used to access Restricted or CUI data without explicit written approval and enhanced controls.
3.3 Devices operating on unsupported OS versions (end-of-life from the manufacturer) are not permitted to access organizational systems.

4. MDM ENROLLMENT
4.1 All devices (corporate and approved BYOD) must be enrolled in [Organization Name]'s MDM solution before accessing organizational resources.
4.2 MDM enrollment grants IT the ability to: enforce security configurations, push approved applications, locate the device, remotely lock the device, and remotely wipe the device in the event of loss or theft.
4.3 For BYOD devices, MDM applies a managed profile/container. Only data within the managed container (organizational apps and data) is accessible to IT. Personal apps, photos, and data outside the managed container are not accessible to the organization.

5. SECURITY REQUIREMENTS
5.1 All enrolled devices must meet these minimum security requirements enforced via MDM:
- Screen lock with PIN (minimum 6 digits), passphrase, or biometric after 5 minutes of inactivity
- Full device encryption enabled (required on iOS and Android by default; must be verified)
- Latest available OS version (or within 1 major version)
- Latest available security patches (within 30 days of release)
- Approved endpoint protection/EDR application installed where available
- Remote wipe capability enabled and tested
5.2 Jailbroken or rooted devices are prohibited from accessing organizational systems. MDM must detect and block jailbroken/rooted status.
5.3 Applications from unofficial sources (sideloading) are prohibited on enrolled devices.

6. REMOTE WIPE
6.1 If a device is lost, stolen, or the employee is separated, IT will initiate a remote wipe without additional approval.
6.2 For BYOD devices, remote wipe targets only the managed organizational container/profile. Personal data outside the managed profile is not affected.
6.3 Employees must report lost or stolen devices to IT within 1 hour of discovery. Failure to report promptly may result in a data breach notification obligation.

7. APPLICATION MANAGEMENT
7.1 Organizational applications must be installed only from the MDM-managed enterprise app catalog or approved public app stores.
7.2 Employees must not use personal cloud sync applications (personal Dropbox, personal iCloud) to store or transfer organizational data.
7.3 Organizational data must not be copied to personal applications or personal storage.

8. PRIVACY (BYOD)
For BYOD devices, [Organization Name] collects only data relevant to the managed profile: installed managed apps, device security posture (encryption, OS version, screen lock), and device location during active MDM sessions. The organization does not collect personal browsing history, personal app data, photos, or communications.

9. ROLES AND RESPONSIBILITIES
- IT/MDM Team: Configure and maintain MDM; enroll devices; respond to loss/theft; perform remote wipes.
- All Employees: Comply with enrollment requirements; report lost/stolen devices immediately.
- Managers: Ensure team members understand and comply with this policy.

10. ENFORCEMENT
Devices that do not meet MDM compliance requirements will be blocked from accessing organizational resources. Circumventing MDM controls may result in disciplinary action.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "network-security",
    title: "Network Security Policy",
    category: "security",
    description: "Standards for network segmentation, firewall management, VPN, wireless security, and network monitoring. Satisfies CMMC SC.1.175, FedRAMP SC-7, SOC 2 CC6.6.",
    content: `NETWORK SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for designing, configuring, and maintaining the security of [Organization Name] networks to prevent unauthorized access, limit the impact of security incidents through segmentation, and provide visibility into network activity.

2. SCOPE
This policy applies to all network infrastructure operated by [Organization Name], including on-premises networks, cloud virtual networks (VPCs, VNets), wireless networks, SD-WAN, and VPN infrastructure.

3. NETWORK SEGMENTATION
3.1 The organizational network must be segmented into security zones with traffic controls enforced between zones. Minimum required zones:
- Production zone: Systems that host production workloads and customer data
- Development/Staging zone: Non-production systems; must not contain real customer data
- Corporate/Internal zone: Employee workstations and internal services
- DMZ: Internet-facing systems (web servers, load balancers, API gateways)
- Management zone: Administrative/out-of-band management interfaces
3.2 Default-deny firewall policies must be applied between all zones. All permitted traffic must be explicitly allowed in documented firewall rules.
3.3 Direct traffic flows between the Production zone and Corporate/Internal zone must be minimized; administrative access to production must route through the Management zone or jump server.
3.4 Database and data store servers must not be directly accessible from the Internet or the DMZ; they must reside in a protected internal zone accessible only by application tier services.

4. FIREWALL MANAGEMENT
4.1 All firewall rules must be documented with: rule purpose, source, destination, port/protocol, approver, and creation date.
4.2 Firewall rules must be reviewed quarterly. Rules that no longer have a documented business justification must be removed.
4.3 Changes to firewall rules must follow the Change Management Policy and require approval from IT Security before implementation.
4.4 "Any/Any" rules or rules that allow unrestricted inbound access from the internet to internal systems are prohibited without documented exception.

5. REMOTE ACCESS (VPN)
5.1 All remote access to internal systems must occur via the organizational VPN solution.
5.2 VPN access requires MFA authentication per the MFA Policy.
5.3 VPN configurations must enforce split tunneling controls - by default, all organizational traffic must route through the VPN tunnel.
5.4 VPN logs must be retained for a minimum of 1 year.

6. WIRELESS NETWORK SECURITY
6.1 Corporate wireless networks must use WPA3 or WPA2-Enterprise (802.1X) authentication.
6.2 Guest wireless networks must be logically isolated from corporate networks on a separate VLAN with no access to internal resources.
6.3 Wireless access point default credentials must be changed immediately upon deployment.
6.4 Rogue wireless access point detection must be implemented in all facilities.

7. INTRUSION DETECTION AND PREVENTION
7.1 Network-based intrusion detection/prevention systems (IDS/IPS) or cloud-native equivalents (AWS GuardDuty, Azure Defender for Cloud) must be deployed to monitor traffic for malicious activity.
7.2 IDS/IPS alerts must integrate with the SIEM for centralized alerting and investigation.
7.3 IDS/IPS signatures/rules must be updated automatically or reviewed weekly.

8. DNS SECURITY
8.1 DNS queries from organizational systems must route through controlled DNS resolvers; employees must not configure unauthorized DNS servers.
8.2 DNS filtering must be implemented to block known malicious domains.

9. NETWORK MONITORING AND LOGGING
9.1 All network boundary traffic (ingress and egress) must be logged.
9.2 Logs must be forwarded to the SIEM and retained per the Audit Logging Policy.
9.3 Anomalous network behavior (unusual data volume, unusual destinations, unexpected protocols) must generate automated alerts.

10. ROLES AND RESPONSIBILITIES
- IT/Network Team: Design, implement, and maintain network segmentation and controls.
- Security Team: Monitor IDS/IPS alerts; conduct network access reviews.
- All Employees: Comply with VPN requirements; report unusual network behavior.

Policy Owner: [CISO / IT Network Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "security-awareness",
    title: "Security Awareness Training Policy",
    category: "hr",
    description: "Requirements for security awareness training, phishing simulations, and role-based security education. Satisfies CMMC AT.2.056, FedRAMP AT-2, SOC 2 CC1.4.",
    content: `SECURITY AWARENESS TRAINING POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for security awareness training to ensure all personnel understand security risks, their security obligations, and how to recognize and report security threats. This policy satisfies CMMC AT.2.056, FedRAMP AT-2, and SOC 2 CC1.4.

2. SCOPE
This policy applies to all employees, contractors, and third-party personnel with access to [Organization Name] systems or data.

3. BASELINE SECURITY AWARENESS TRAINING
3.1 All personnel must complete baseline security awareness training before being granted system access and annually thereafter.
3.2 Baseline training must cover at minimum:
- Information security policy overview and employee obligations
- Identifying phishing and social engineering attacks
- Password and MFA best practices
- Data classification and handling requirements
- Acceptable and prohibited use of organizational systems
- Incident reporting procedures
- Physical security (tailgating, clean desk, screen lock)
- Remote work security requirements
- Consequences of non-compliance
3.3 Training completion must be tracked per individual. Certificates of completion must be retained as evidence.
3.4 Personnel who do not complete annual training within 30 days of the due date will have system access suspended until training is completed.

4. ROLE-BASED SUPPLEMENTAL TRAINING
4.1 The following roles require additional specialized training annually:
- Developers and Engineers: Secure coding practices, OWASP Top 10, dependency security, secrets management (minimum 4 additional hours/year)
- System Administrators and IT: Privileged access security, incident response procedures, patch management (minimum 4 additional hours/year)
- HR Personnel: Handling of sensitive personal data, GDPR/privacy rights, background screening procedures
- Executives and Board Members: Social engineering targeting executives (CEO fraud, BEC), cybersecurity governance responsibilities
- Personnel handling CUI: CUI handling requirements, CMMC awareness, reporting obligations

5. PHISHING SIMULATION PROGRAM
5.1 Simulated phishing campaigns must be conducted at minimum quarterly across all personnel.
5.2 Personnel who click on simulated phishing links must complete remedial phishing awareness training within 5 business days.
5.3 Phishing simulation results (click rates, report rates, remediation completion) must be tracked and reported to the CISO quarterly.
5.4 Repeat phishing failures (3 or more in a 12-month period) require mandatory escalation to the employee's manager and documented corrective action.

6. TRAINING METRICS AND REPORTING
6.1 The following metrics must be tracked and reported to the CISO monthly:
- Training completion rate by department (target: 100% within 30 days of due date)
- Phishing simulation click rate (target: <5%)
- Phishing simulation report rate (target: >80% of simulated campaigns reported)
- Remedial training completion rate (target: 100% within 5 days)
6.2 Training completion rates must be included in the quarterly board security report.

7. ROLES AND RESPONSIBILITIES
- Security Team: Design and manage the training program; operate phishing simulations; report metrics.
- HR: Integrate training requirements into onboarding; track completion.
- Managers: Ensure team members complete required training by deadlines.
- All Personnel: Complete required training promptly; report real and simulated phishing.

8. ENFORCEMENT
Non-completion of required training within stated deadlines will result in system access suspension.

Policy Owner: [CISO / HR Director]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "ai-use",
    title: "AI & Generative AI Use Policy",
    category: "operations",
    description: "Guidelines for responsible employee use of AI and generative AI tools, including data input restrictions, output review, and approved tool list.",
    content: `AI & GENERATIVE AI USE POLICY
Version: 1.0 | Review Cycle: Semi-Annual | Classification: Internal

1. PURPOSE
This policy governs the use of artificial intelligence (AI), machine learning (ML), and generative AI tools - including large language models (LLMs) such as ChatGPT, Claude, Gemini, GitHub Copilot, and similar tools - by [Organization Name] personnel. These tools offer significant productivity benefits but introduce data security, intellectual property, and compliance risks that must be managed.

2. SCOPE
This policy applies to all employees, contractors, and consultants who use any AI tool - including consumer, enterprise, and developer-facing AI tools - in connection with their work at [Organization Name].

3. APPROVED AI TOOLS
3.1 The Security team maintains and publishes the current approved AI tools list. Employees must not use AI tools not on the approved list with organizational data.
3.2 Consumer-tier AI services (free tiers of ChatGPT, Gemini, etc.) must not be used with any organizational data beyond Public classification, as consumer tiers may use input data to train models.
3.3 Enterprise-tier versions with data processing agreements and no training-on-input terms may be approved for Confidential data by the Security team.
3.4 No AI tool may process, store, or transmit Restricted data or Controlled Unclassified Information without explicit written approval from the CISO and legal review of the tool's data handling terms.

4. DATA INPUT RESTRICTIONS
Before entering data into any AI tool, employees must determine the data's classification:
- Public data: May be used with any approved AI tool.
- Internal data: May only be used with tools on the approved internal list.
- Confidential data: May only be used with enterprise-tier approved tools; do not input client-identifying information, financial data, or personnel records.
- Restricted / CUI data: No AI tool input permitted without explicit CISO approval.
- Source code: May be used with approved code assistance tools; must not include credentials, API keys, or secrets in prompts.

5. OUTPUT REVIEW AND ACCOUNTABILITY
5.1 AI-generated content - including code, written content, analysis, and recommendations - must be reviewed and validated by a human before use, sharing, or acting upon it.
5.2 Employees who submit AI-generated work are responsible for its accuracy, quality, and compliance with organizational standards.
5.3 AI-generated content must not be submitted as original human work in contexts where authenticity matters (e.g., regulatory submissions, legal documents, certifications, or client reports without disclosure).

6. PROHIBITED USES
- Using AI to make final decisions about individuals' employment, credit, or legal rights without human review
- Using AI to generate deceptive content, deepfakes, or impersonations
- Entering credentials, passwords, API keys, or secrets into any AI tool
- Using AI to attempt to bypass security controls or generate malware
- Using AI to generate content that violates applicable law or the Acceptable Use Policy

7. INTELLECTUAL PROPERTY
7.1 AI-generated content may not be fully protected by copyright in all jurisdictions. Legal must be consulted before using AI-generated content in client deliverables where IP ownership matters.
7.2 When using AI code generation tools, employees must comply with the license terms of any code suggested by the AI.

8. NEW TOOL APPROVAL PROCESS
8.1 Requests for new AI tools must be submitted to the Security team for review.
8.2 Security review includes: data handling and retention terms, training-on-input provisions, data residency, subprocessor list, and SOC 2 / ISO 27001 availability.
8.3 Tools that retain user inputs for model training or do not offer DPA execution must not be approved for use with Internal or higher classified data.

9. ROLES AND RESPONSIBILITIES
- Security Team: Maintain approved tools list; conduct tool security reviews; update this policy as the AI landscape evolves.
- All Employees: Classify data before input; review AI outputs; use only approved tools.
- Legal: Advise on IP and regulatory implications of AI use.

Policy Owner: [CISO / Legal]
Effective Date: [DATE]
Next Review: [DATE - semi-annual review given rapid AI evolution]`,
  },
  {
    key: "cloud-security",
    title: "Cloud Security Policy",
    category: "security",
    description: "Security controls for cloud infrastructure including IaC, IAM, CSPM, data residency, and approved services. Satisfies CMMC SC.3.187, FedRAMP SA-9, SOC 2 A1.1.",
    content: `CLOUD SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for the use, configuration, and management of cloud infrastructure and cloud services by [Organization Name]. Cloud environments require security controls equivalent to or exceeding those required for on-premises systems, with additional controls to address cloud-specific risks.

2. SCOPE
This policy applies to all cloud infrastructure (IaaS), platform services (PaaS), and software-as-a-service (SaaS) applications used by [Organization Name] for production, development, staging, or administrative purposes.

3. APPROVED CLOUD PROVIDERS
3.1 Cloud providers must be approved by IT Security before organizational data may be stored or processed.
3.2 For systems processing federal data (CUI, FCI): Cloud providers must hold FedRAMP authorization at the appropriate impact level. Approved federal-tier providers include: AWS GovCloud, Azure Government, and Google Cloud for Government.
3.3 For commercial-tier systems: Cloud providers must hold SOC 2 Type II certification or equivalent and must execute a Data Processing Agreement (DPA) with [Organization Name].

4. CLOUD ACCESS AND IDENTITY
4.1 Root/master cloud accounts must not be used for day-to-day administration. A dedicated root account break-glass credential must be stored in a secure secrets manager and its use logged and reviewed.
4.2 All cloud user accounts must be provisioned via the organization's identity provider (IdP); direct cloud-native user accounts are not permitted except for service accounts and break-glass access.
4.3 MFA is mandatory for all cloud management console access and for all accounts with any IAM permissions.
4.4 Cloud IAM roles and permissions must follow least-privilege principles. Wildcard permissions ("*") on sensitive actions are prohibited without documented exception approved by the CISO.
4.5 Cloud IAM permissions must be reviewed quarterly; unused permissions and dormant accounts must be removed.

5. INFRASTRUCTURE AS CODE (IaC)
5.1 All cloud infrastructure must be defined and deployed using Infrastructure as Code (IaC) tools (e.g., Terraform, CloudFormation, Pulumi). Manual console-based infrastructure provisioning in production is prohibited without emergency exception.
5.2 IaC code must be stored in version-controlled repositories with access controls.
5.3 IaC must be scanned for security misconfigurations using automated scanning tools before deployment to production.

6. PROHIBITED CONFIGURATIONS
The following configurations are prohibited in all cloud environments without documented exception:
- S3 buckets, Azure Blob Storage, or equivalent with public read/write access (unless serving public website content by explicit design)
- Security groups or network access controls permitting unrestricted inbound access (0.0.0.0/0) to administrative ports (SSH/22, RDP/3389, database ports)
- Encryption-at-rest disabled on any data store
- MFA disabled on any cloud user account with administrative permissions
- Logging disabled (CloudTrail, Azure Activity Log, GCP Audit Log) on any production account

7. CLOUD SECURITY POSTURE MANAGEMENT (CSPM)
7.1 A CSPM tool must be deployed to continuously monitor cloud configurations against security benchmarks.
7.2 CSPM findings at Critical and High severity must be reviewed within 24 hours and remediated per vulnerability management SLAs.

8. DATA RESIDENCY
8.1 All data classified as Restricted or containing CUI must be stored only in regions within the United States.
8.2 Data replication, backup, and disaster recovery copies must respect the same residency requirements as primary data.

9. SECRETS MANAGEMENT
Credentials, API keys, database passwords, and other secrets must not be stored in source code, IaC templates, environment variable files committed to version control, or unencrypted configuration files. All secrets must be stored in an approved secrets management service.

10. ROLES AND RESPONSIBILITIES
- Cloud/Infrastructure Team: Implement and maintain cloud security controls; manage IaC; operate CSPM.
- Security Team: Define cloud security requirements; review CSPM findings; approve exceptions.
- All Engineers: Follow IaC practices; not commit secrets; use approved services.

Policy Owner: [CISO / Head of Engineering]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "software-development",
    title: "Secure Software Development Policy",
    category: "operations",
    description: "Security requirements for the SDLC including threat modeling, code review, SAST/DAST, secrets management, and deployment approvals.",
    content: `SECURE SOFTWARE DEVELOPMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for the software development lifecycle (SDLC) to ensure that security is built into [Organization Name]'s software from design through deployment.

2. SCOPE
This policy applies to all software developed, maintained, or customized by [Organization Name] employees or contractors, whether for internal use or delivery to clients.

3. SECURITY BY DESIGN
3.1 Threat modeling must be performed for all new significant features, integrations, or system components before development begins. Threat models must identify: what data is being handled, trust boundaries, potential adversary goals, and mitigating controls.
3.2 Security requirements must be defined alongside functional requirements and included in the definition of "done" for each feature.
3.3 Security architecture decisions must be reviewed by the Security team for systems handling Confidential or Restricted data before implementation.

4. SECURE CODING STANDARDS
4.1 All developers must be trained in secure coding practices relevant to their technology stack.
4.2 Code must follow OWASP guidelines for the relevant environment (OWASP Top 10 for web, OWASP Mobile Top 10 for mobile, OWASP API Security Top 10 for APIs).
4.3 The following vulnerabilities are unacceptable in production code and must be remediated before release: SQL injection, command injection, cross-site scripting (XSS), cross-site request forgery (CSRF), insecure deserialization, hard-coded credentials, and use of cryptographically weak algorithms.

5. CODE REVIEW
5.1 All code must be reviewed by at least one developer other than the author before merging to the main branch.
5.2 Code review must include a security review checklist appropriate to the change being made.

6. AUTOMATED SECURITY SCANNING
6.1 The following automated scanning must be integrated into the CI/CD pipeline:
- SAST (Static Application Security Testing): Run on every pull request and merge to main.
- SCA (Software Composition Analysis / dependency scanning): Run on every build. Dependencies with known Critical or High CVEs must block production deployment until updated or risk-accepted.
- Secrets scanning: Run on every commit. Commit containing detected secrets must be blocked; detected secrets must be treated as compromised and rotated immediately.
- Container image scanning (if applicable): Run before image publication.
6.2 Critical SAST findings must be reviewed within 24 hours; High findings within 5 business days.

7. SECRETS MANAGEMENT
7.1 No credentials, API keys, secrets, private keys, or passwords may be committed to version control under any circumstances.
7.2 All secrets must be stored in an approved secrets management service and accessed at runtime via environment variables or SDK.
7.3 Development and test credentials must be separate from production credentials.

8. ENVIRONMENTS
8.1 Production, staging, and development must be distinct environments with separate credentials and access controls.
8.2 Real customer data must not be used in development or staging environments. Test data must be synthetic or anonymized.
8.3 Production deployment access must be limited; all production deployments must occur via the CI/CD pipeline.

9. DEPENDENCY MANAGEMENT
9.1 All third-party dependencies must be tracked in a dependency manifest.
9.2 Dependencies must be regularly updated; end-of-life or abandoned dependencies must be replaced.
9.3 The organization must maintain a Software Bill of Materials (SBOM) for production systems.

10. ROLES AND RESPONSIBILITIES
- Security Team: Define scanning tools; review findings; conduct pre-release reviews.
- Engineering Leads: Enforce code review standards; ensure developers are trained.
- Developers: Follow secure coding practices; remediate security findings; never commit secrets.

Policy Owner: [CISO / Head of Engineering]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "asset-management",
    title: "Asset Management Policy",
    category: "operations",
    description: "Requirements for hardware and software asset inventory, classification, lifecycle management, and secure decommissioning.",
    content: `ASSET MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for the identification, classification, tracking, and lifecycle management of hardware and software assets owned or managed by [Organization Name]. Complete and accurate asset inventory is the foundation of effective security management.

2. SCOPE
This policy covers: all hardware assets (servers, workstations, laptops, mobile devices, network equipment, printers, and storage media), all software assets (licensed software, open source dependencies, SaaS subscriptions), and all cloud resources provisioned by the organization.

3. ASSET INVENTORY
3.1 [Organization Name] must maintain a current, complete asset inventory updated within 5 business days of any asset addition, change, or removal.
3.2 For each hardware asset: unique asset identifier/tag, asset type, manufacturer/model, serial number, assigned user or location, operating system and version, purchase date, warranty expiry, and current status.
3.3 For each software asset: software name and version, vendor, license type and quantity, license expiry, systems installed on, and business owner.
3.4 Cloud resources must be inventoried via cloud-native tagging: Owner, Environment, Data classification, and Cost center.
3.5 Asset inventory must be reviewed and reconciled against physical/logical reality at least annually.

4. ASSET CLASSIFICATION
All assets must be classified based on the highest classification of data they process or store: Restricted/CUI, Confidential, Internal, or Public. Classification determines the security controls required.

5. HARDWARE LIFECYCLE
5.1 Procurement: All hardware must be sourced from approved vendors. New assets must be registered in inventory before deployment.
5.2 Deployment: New devices must be configured to the security baseline before connection to organizational networks.
5.3 Maintenance: Hardware assets must be maintained per manufacturer support schedules; end-of-life assets must have a documented remediation plan.
5.4 Decommissioning: Before disposal, all storage media must be sanitized per NIST SP 800-88. A decommission record must document the asset ID, disposition date, and sanitization method.

6. SOFTWARE LIFECYCLE
6.1 Only approved software may be installed on organizational systems.
6.2 End-of-life or unsupported software that receives no further security patches must be removed or isolated; compensating controls must be documented.
6.3 Open source software used in organizational systems must be tracked in a Software Bill of Materials (SBOM) and reviewed for license compliance.

7. LOST OR STOLEN ASSETS
7.1 Any lost or stolen organizational asset must be reported to IT and the Security team within 1 hour of discovery.
7.2 Incidents involving lost/stolen devices containing Confidential or Restricted data must be treated as potential data breaches.

8. ROLES AND RESPONSIBILITIES
- IT: Maintain asset inventory; provision and decommission hardware; manage software licenses.
- All Employees: Report asset changes (lost, stolen, broken, returned); do not install unauthorized software.
- Security Team: Audit asset inventory; review decommission records.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "privacy",
    title: "Privacy Policy (Internal Data Handling)",
    category: "data",
    description: "Internal guidelines for collecting, processing, storing, and protecting personal data of employees, clients, and users. Supports GDPR, CCPA, SOC 2 Privacy, and FedRAMP AR-1.",
    content: `PRIVACY POLICY (INTERNAL DATA HANDLING STANDARD)
Version: 1.0 | Review Cycle: Annual | Classification: Internal
Note: This is the internal data handling policy. The public-facing customer Privacy Policy is published at [organization website URL].

1. PURPOSE
This policy establishes [Organization Name]'s internal standards for the collection, use, storage, sharing, and disposal of personal data. Compliance with applicable privacy laws - including GDPR, CCPA, and privacy provisions of federal frameworks - is mandatory.

2. SCOPE
This policy applies to all personal data processed by [Organization Name] in any context: employee data, client/customer data, user data collected through the EnterpriseComply platform, and data received from third parties.

3. DATA MINIMIZATION AND PURPOSE LIMITATION
3.1 [Organization Name] collects only personal data necessary for a stated, legitimate purpose. Collecting personal data "just in case" is prohibited.
3.2 Personal data collected for one purpose must not be used for a different, incompatible purpose without the data subject's consent or a separate legal basis.
3.3 Employees and contractors must not access personal data beyond what is required for their job function.

4. LEGAL BASIS FOR PROCESSING
All processing of personal data must have a valid legal basis under applicable law:
- Contract: Processing necessary to fulfill a contract with the data subject
- Legal Obligation: Processing required by law
- Legitimate Interest: Processing where interests are balanced against data subject rights
- Consent: Where required and where other bases do not apply; consent must be freely given, specific, informed, and withdrawable

5. DATA SUBJECT RIGHTS
5.1 [Organization Name] respects and facilitates the following rights for individuals whose data we process:
- Right of Access: Request a copy of personal data held
- Right to Rectification: Request correction of inaccurate data
- Right to Erasure: Request deletion where there is no legal basis to retain
- Right to Portability: Receive data in a machine-readable format
- Right to Object: Object to processing based on legitimate interest
5.2 Data subject requests must be logged and responded to within 30 days.
5.3 Data subject requests received by any employee must be forwarded to the Data Protection Officer (or Privacy Lead) within 24 hours.

6. DATA SHARING AND THIRD PARTIES
6.1 Personal data must not be shared with third parties except: where required by law, with service providers who have signed appropriate data processing agreements, or with explicit consent of the data subject.
6.2 All service providers who process personal data on our behalf must be listed in our subprocessor register and have executed a Data Processing Agreement (DPA).

7. DATA BREACH NOTIFICATION
7.1 Suspected personal data breaches must be reported to the Privacy Lead and Security team immediately.
7.2 If a breach is confirmed and likely to result in risk to individuals: GDPR requires notification to the relevant supervisory authority within 72 hours.

8. PRIVACY BY DESIGN
New systems, features, and processes that involve personal data must incorporate privacy considerations at the design stage. A privacy impact assessment must be conducted for high-risk processing activities.

9. ROLES AND RESPONSIBILITIES
- Data Protection Officer / Privacy Lead: Oversee compliance; handle data subject requests; manage breach notifications.
- All Employees: Process personal data only as authorized; report suspected breaches immediately.
- Legal: Advise on applicable law; maintain DPA templates.

Policy Owner: [DPO / Legal / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "whistleblower",
    title: "Whistleblower & Ethics Policy",
    category: "hr",
    description: "Protections and procedures for employees reporting compliance violations, unethical conduct, or security concerns in good faith.",
    content: `WHISTLEBLOWER & ETHICS POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
[Organization Name] is committed to the highest standards of ethical conduct and legal compliance. This policy establishes protected channels for personnel to report suspected violations of law, regulation, or organizational policy, and provides meaningful protections against retaliation for good-faith reporting.

2. SCOPE
This policy applies to all [Organization Name] employees, contractors, and consultants.

3. WHAT TO REPORT
Personnel are encouraged to report:
- Violations of law or regulation, including data privacy laws and export control regulations
- Financial fraud, misrepresentation, or improper accounting
- Cybersecurity incidents, data breaches, or policy violations not being addressed
- Conflicts of interest not properly disclosed
- Workplace safety violations
- Discrimination, harassment, or other HR policy violations
- Retaliation against someone for previous good-faith reporting

4. REPORTING CHANNELS
4.1 Reports may be made through any of the following channels:
- Direct Report: Directly to your manager (if not involved in the matter)
- HR: human-resources@[organization].com
- CISO (for cybersecurity and data issues): security@[organization].com
- Legal: legal@[organization].com
- Direct to Board: board@[organization].com (for matters involving executive leadership)
4.2 Anonymous reporting is accepted and protected.
4.3 For matters involving potential violations of federal law or contracts, personnel may also report directly to relevant federal authorities.

5. INVESTIGATION PROCESS
5.1 All reports will be acknowledged within 3 business days.
5.2 Reports will be investigated by an appropriate party independent of the subject of the report.
5.3 Target investigation completion: 45 days from report receipt.

6. ANTI-RETALIATION PROTECTIONS
6.1 Retaliation against any person for making a good-faith report under this policy is strictly prohibited and is itself a policy violation subject to disciplinary action up to termination.
6.2 Retaliation includes: termination, demotion, suspension, reduced pay, negative performance reviews, exclusion from projects, intimidation, or any other adverse action connected to the report.
6.3 If a reporter believes they are experiencing retaliation, they should report it immediately through any available channel.

7. CONFIDENTIALITY
The identity of reporters will be kept confidential to the extent possible consistent with conducting a fair investigation.

8. ROLES AND RESPONSIBILITIES
- All Personnel: Report suspected violations; cooperate with investigations; not retaliate.
- HR: Receive and route reports; manage anti-retaliation cases.
- Legal: Investigate or oversee investigations; advise on legal obligations.

Policy Owner: [HR Director / General Counsel]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "clean-desk",
    title: "Clean Desk & Screen Lock Policy",
    category: "security",
    description: "Requirements for securing workstations, screens, and physical documents when unattended to prevent unauthorized viewing or access.",
    content: `CLEAN DESK & SCREEN LOCK POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for securing workstations and physical documents to prevent unauthorized individuals from viewing, accessing, or removing confidential information when employees are away from their workspace.

2. SCOPE
This policy applies to all employees, contractors, and consultants at all [Organization Name] facilities and when working remotely.

3. SCREEN LOCK REQUIREMENTS
3.1 Workstations must be configured to lock automatically after a maximum of 5 minutes of inactivity.
3.2 Employees must manually lock their screens (Windows: Win+L; macOS: Control+Command+Q) whenever they leave their workstation, even briefly.
3.3 Screen lock must require a password or biometric to unlock. Auto-login or bypassing screen lock is prohibited.
3.4 These settings will be enforced by MDM policy where applicable.

4. CLEAN DESK REQUIREMENTS
4.1 At the end of each workday (and whenever leaving the workspace for extended periods), employees must clear their desks of all Confidential or Restricted documents, notebooks, printed materials, and removable media.
4.2 Documents must be secured in a locked drawer, cabinet, or shredded if no longer needed.
4.3 Whiteboards and flip charts containing Confidential or Restricted information must be erased or turned to a blank page when the meeting or work session ends.
4.4 Printers: Employees must retrieve printed documents immediately after printing. Documents must never be left in printer trays or output bins.

5. VISITOR AND SHARED SPACE CONSIDERATIONS
5.1 When visitors or unauthorized personnel are present, employees must ensure that Confidential or Restricted information on screens, desks, or whiteboards is not visible.
5.2 In open-plan offices or co-working spaces, employees must use privacy screens when working with Confidential or Restricted data.
5.3 In public locations (cafes, airports, trains), employees must use privacy screens and ensure screens cannot be read by passersby.

6. COMPLIANCE VERIFICATION
IT/Security may conduct periodic unannounced clean desk inspections. Non-compliant workstations will be flagged and the employee's manager notified.

7. ROLES AND RESPONSIBILITIES
- All Employees: Follow clean desk and screen lock requirements at all times.
- IT: Enforce screen lock via MDM and Group Policy; provide privacy screen filters.
- Security Team: Conduct periodic inspections; report non-compliance.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "media-handling",
    title: "Removable Media Policy",
    category: "security",
    description: "Controls for the use, encryption, tracking, and secure disposal of USB drives, external hard drives, and other removable storage media.",
    content: `REMOVABLE MEDIA POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy governs the use of removable storage media (USB drives, external hard drives, SD cards, optical media, and similar devices) to prevent unauthorized data exfiltration, introduction of malware, and loss of Confidential or Restricted data.

2. SCOPE
This policy applies to all removable storage media used with [Organization Name] systems or to store organizational data, whether corporate-owned or personally-owned.

3. APPROVED MEDIA
3.1 Only removable media issued or approved by IT may be used to store organizational data classified as Internal or above.
3.2 Personally-owned removable media must not be used to store organizational data without explicit written authorization from IT.
3.3 Removable media from unknown or unverified sources must not be connected to organizational systems and must be reported to IT immediately.

4. ENCRYPTION REQUIREMENTS
4.1 All removable media containing Internal, Confidential, or Restricted data must be fully encrypted using AES-256 or equivalent.
4.2 Hardware-encrypted USB drives are preferred over software-encrypted drives.
4.3 Unencrypted removable media must not be used to store organizational data beyond Public classification.

5. DATA LOSS PREVENTION (DLP)
5.1 Where technically feasible, DLP controls must be implemented to monitor and restrict data transfers to removable media.
5.2 Transfer of Restricted or CUI data to removable media requires written pre-approval from the data owner and the CISO.
5.3 IT may disable USB ports on systems with no legitimate business requirement for removable media use.

6. TRACKING AND ACCOUNTABILITY
6.1 Corporate-issued removable media must be logged in the asset inventory with: asset ID, media type, capacity, assigned user, and data classification of content.
6.2 Employees are responsible for the security of removable media assigned to them.

7. LOSS OR THEFT
7.1 Loss or theft of removable media must be reported to IT and the Security team within 1 hour of discovery.
7.2 Loss of removable media containing Confidential or Restricted data must be treated as a potential data breach per the Data Breach Response Policy.

8. DISPOSAL
8.1 Removable media must not be discarded in regular trash or recycling.
8.2 Internal or below: Overwrite using approved software, then discard.
8.3 Confidential: Physical destruction (shredding) or secure wipe with verification.
8.4 Restricted / CUI: Physical destruction with written certification.
8.5 IT must document the disposal of all tracked removable media assets.

9. ROLES AND RESPONSIBILITIES
- IT: Issue and track approved removable media; enforce DLP controls; dispose of media.
- All Employees: Use only approved media; encrypt data; report loss immediately.
- Security Team: Investigate media-related incidents; review DLP alerts.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "backup-recovery",
    title: "Backup & Recovery Policy",
    category: "operations",
    description: "Requirements for data backup frequency, offsite storage, encryption, and tested restoration to meet RTO/RPO targets. Satisfies CMMC CP.2.001, FedRAMP CP-9, SOC 2 A1.2.",
    content: `BACKUP & RECOVERY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for data backup, offsite storage, and recovery testing to ensure that [Organization Name] can restore critical systems and data within acceptable timeframes following data loss, corruption, ransomware, or disaster. This policy satisfies CMMC CP.2.001, FedRAMP CP-6/CP-9, and SOC 2 A1.2.

2. SCOPE
This policy applies to all production data, systems, databases, and configurations operated by [Organization Name], including cloud-hosted and on-premises systems.

3. SYSTEM CRITICALITY TIERS AND RTO/RPO TARGETS

Tier 1 - Critical (production platform and client-facing services):
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 1 hour
- Backup frequency: Continuous replication or snapshots every 1 hour

Tier 2 - Important (internal systems, admin tools):
- Recovery Time Objective (RTO): 24 hours
- Recovery Point Objective (RPO): 4 hours
- Backup frequency: Snapshots every 4 hours or daily

Tier 3 - Standard (non-critical internal resources):
- Recovery Time Objective (RTO): 72 hours
- Recovery Point Objective (RPO): 24 hours
- Backup frequency: Daily

4. BACKUP REQUIREMENTS
4.1 Backups must follow the 3-2-1 rule: 3 copies of data, on 2 different media types or storage systems, with 1 copy offsite or in a separate cloud region.
4.2 All backups must be encrypted using AES-256 or equivalent. Encryption keys must be managed separately from the backup data.
4.3 Backups must be stored in a geographically separate location from the primary data.
4.4 Backup jobs must be monitored; failures must generate immediate alerts investigated within 4 hours.

5. BACKUP RETENTION SCHEDULES
- Daily snapshots: Retained for 30 days
- Weekly snapshots: Retained for 90 days (13 weeks)
- Monthly snapshots: Retained for 12 months
- Annual snapshots: Retained per the Data Retention Policy for the data type

6. BACKUP TESTING AND VERIFICATION
6.1 Backup restoration must be tested at minimum:
- Monthly: Automated verification of backup integrity (hash/checksum validation)
- Quarterly: Partial restoration test - restore a representative sample of critical data to a staging environment and verify correctness
- Annually: Full disaster recovery exercise - simulate complete loss of primary environment and restore from backup to target RTO/RPO
6.2 All recovery tests must be documented with: test date, systems tested, data restored, recovery time achieved vs. target, issues encountered, and corrective actions.
6.3 Recovery test results must be reported to the CISO and retained for 3 years.

7. RANSOMWARE RESILIENCE
7.1 At least one backup copy must be air-gapped or immutable (cannot be modified or deleted by ransomware) - for example: AWS S3 Object Lock or Azure Immutable Blob Storage.
7.2 Backup administrative credentials must be separate from production system credentials.

8. ROLES AND RESPONSIBILITIES
- IT/DevOps: Configure and monitor backups; execute recovery tests; respond to backup failures.
- CISO: Review annual DR test results; approve RTO/RPO targets.
- System Owners: Classify systems into tiers; define acceptable RTO/RPO for their systems.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "patch-management",
    title: "Patch Management Policy",
    category: "security",
    description: "SLA-based requirements for scanning, prioritizing, and applying security patches to OS, applications, containers, and cloud infrastructure. Satisfies CMMC SI.2.214, FedRAMP SI-2, SOC 2 CC7.1.",
    content: `PATCH MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for the timely identification and remediation of security patches and vulnerabilities across all organizational systems. Timely patching is one of the most effective defenses against cyberattacks. This policy satisfies CMMC SI.2.214, FedRAMP SI-2, and SOC 2 CC7.1.

2. SCOPE
This policy applies to all [Organization Name] systems subject to security patching: servers (physical and virtual), workstations, laptops, mobile devices, network devices, cloud instances, containers, and managed applications.

3. VULNERABILITY SCANNING
3.1 All in-scope systems must be scanned for missing patches and vulnerabilities at minimum:
- Production servers and critical infrastructure: Weekly
- Developer workstations and internal systems: Monthly
- Internet-facing systems: Weekly, plus after any significant software update or configuration change
- Container base images: On every build (CI/CD integration)
3.2 Scanning must use authenticated agents or credentials where possible.
3.3 Scan results must be made available to system owners and the Security team within 24 hours of scan completion.

4. PATCH PRIORITIZATION AND SLA
Patches must be applied within the following timeframes from the date the patch is made available:

CRITICAL patches (CVSS 9.0-10.0 or patches for actively exploited zero-days):
- 15 calendar days in standard cases
- 72 hours for patches addressing confirmed active exploitation in the wild (CISA KEV listed)

HIGH patches (CVSS 7.0-8.9):
- 30 calendar days

MEDIUM patches (CVSS 4.0-6.9):
- 90 calendar days

LOW patches (CVSS 0.1-3.9):
- 180 calendar days

5. PATCH TESTING
5.1 Critical and High patches for production servers must be tested in staging/non-production before production deployment where time permits.
5.2 All patch deployments must have a documented rollback plan.

6. PATCH DEPLOYMENT
6.1 Patches must be deployed via an approved patch management tool or automated pipeline.
6.2 Patch deployments to production systems during business hours require a change request per the Change Management Policy, except emergency patches for Critical/actively exploited vulnerabilities.
6.3 Systems that cannot be patched within SLA must have a formal risk acceptance approved by the CISO, with compensating controls documented.

7. END-OF-LIFE SOFTWARE
7.1 Software that no longer receives security patches from the vendor must not be used in production without a documented exception and compensating controls.
7.2 End-of-life software in production must be added to the risk register and tracked to replacement.

8. TRACKING AND REPORTING
Monthly patch compliance metrics must be reported to the CISO:
- Percentage of Critical/High patches applied within SLA (target: 100%)
- Number of systems with overdue patches (target: 0)
- Average time to patch by severity

9. ENFORCEMENT
Systems with overdue Critical or High patches that do not have an approved exception may be isolated from the production network until patched.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "identity-management",
    title: "Identity & Access Management Policy",
    category: "security",
    description: "Standards for user provisioning, deprovisioning, SSO, access reviews, and privileged account management. Satisfies CMMC AC.1.001, FedRAMP AC-2, SOC 2 CC6.2.",
    content: `IDENTITY & ACCESS MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for managing digital identities and controlling access to [Organization Name] systems, applications, and data throughout the user lifecycle. This policy satisfies CMMC AC.1.001/AC.2.007, FedRAMP AC-2/AC-3/AC-6, and SOC 2 CC6.2/CC6.3.

2. SCOPE
This policy applies to all digital identities (user accounts, service accounts, API credentials, machine identities) that access any [Organization Name] system, application, or data.

3. IDENTITY STANDARDS
3.1 Each individual must have a unique identity. Shared accounts are prohibited for human users.
3.2 User accounts must use the organization's corporate email domain as the primary identifier.
3.3 Personal email addresses must not be used as organizational account identifiers.
3.4 Where an Identity Provider (IdP) is in use, all user accounts must be provisioned through the IdP.

4. PROVISIONING
4.1 Access provisioning requires a documented request specifying: requestor, user, systems/applications, access level, business justification, and approver.
4.2 Access must be provisioned following the least-privilege principle.
4.3 Elevated access (administrator, privileged) requires manager approval plus IT Security approval.
4.4 New accounts must have MFA enrolled before first use; see the MFA Policy.

5. ACCESS REVIEWS
5.1 Access reviews must be conducted at the following frequencies:
- Privileged/administrator accounts: Quarterly
- All other accounts: Annually
- Following a significant organizational change: Within 30 days
5.2 During an access review, access rights must be confirmed as still appropriate. Unnecessary access must be removed within 5 business days.
5.3 Access review results must be documented and retained for 3 years.

6. DEPROVISIONING
6.1 Accounts must be disabled (not just password-changed) within the timeframes specified in the HR Security Policy.
6.2 All active sessions must be terminated at deprovisioning.
6.3 After 30 days of account disablement, accounts may be permanently deleted. Accounts must not be reassigned to a new user; new users must always receive a new account.

7. PRIVILEGED ACCOUNTS
7.1 Privileged accounts must be limited to the minimum number necessary.
7.2 Privileged accounts must use a separate account from the user's standard business account.
7.3 Privileged account activity must be logged and logs reviewed monthly.
7.4 Privileged accounts must be subject to quarterly access reviews.

8. SERVICE ACCOUNTS
8.1 Service account credentials must be managed in an approved secrets manager; credentials must not be embedded in code.
8.2 Service account credentials must be rotated at minimum annually.
8.3 Service accounts must not be used by human users for interactive sessions.

9. DORMANT ACCOUNTS
Accounts that have not been used for 90 days must be disabled pending review. IT must generate a monthly report of dormant accounts for security team review.

10. ROLES AND RESPONSIBILITIES
- IT/IAM Team: Own the provisioning and deprovisioning process; conduct access reviews; manage IdP.
- HR: Trigger provisioning at hire; trigger deprovisioning at separation.
- Managers: Approve access requests; participate in access reviews.
- Security Team: Monitor privileged account activity; review access review results.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "configuration-management",
    title: "Configuration Management Policy",
    category: "operations",
    description: "Requirements for security baseline configuration, IaC standards, configuration drift detection, and change control. Satisfies CMMC CM.2.061, FedRAMP CM-6, SOC 2 CC8.1.",
    content: `CONFIGURATION MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for maintaining secure, consistent, and documented configurations for all [Organization Name] systems, reducing attack surface and preventing unauthorized configuration changes. This policy satisfies CMMC CM.2.061/CM.2.062, FedRAMP CM-6/CM-7, and SOC 2 CC8.1.

2. SCOPE
This policy applies to all systems within the [Organization Name] authorization boundary: servers, workstations, cloud instances, network devices, containers, and security appliances.

3. SECURITY BASELINE CONFIGURATIONS
3.1 Security baseline configurations must be defined for each major system type using industry-recognized benchmarks:
- Servers (Linux): CIS Benchmark for the specific distribution (minimum Level 1)
- Servers (Windows): CIS Benchmark for Windows Server (minimum Level 1) or STIG
- Workstations (macOS/Windows): CIS Benchmark or vendor security baseline (minimum Level 1)
- Cloud infrastructure (AWS/Azure/GCP): CIS Cloud Benchmark for the relevant provider
- Containers: CIS Benchmark for Docker/Kubernetes (minimum Level 1)
3.2 Baseline configurations must be documented and version-controlled.
3.3 Systems must not be deployed to production without being configured to the baseline.

4. HARDENING REQUIREMENTS
4.1 Default credentials must always be changed before deployment.
4.2 All unnecessary services, protocols, and ports must be disabled.
4.3 OS and application logging must be enabled and configured to forward to the SIEM.
4.4 Remote management interfaces must be restricted to the management network only.

5. INFRASTRUCTURE AS CODE
5.1 All cloud infrastructure and server provisioning must be managed as code (Terraform, CloudFormation, Ansible, or equivalent). Manual configuration changes to production systems are prohibited except in documented emergencies.
5.2 IaC must be version-controlled with appropriate access controls and reviewed before merging.
5.3 IaC templates must be scanned for security misconfigurations before deployment.
5.4 Post-emergency: IaC must be updated to reflect emergency changes within 48 hours.

6. CONFIGURATION DRIFT DETECTION
6.1 A configuration drift detection tool must be deployed to continuously compare actual system configurations against approved baselines.
6.2 Detected drift must generate alerts within 1 hour of detection.
6.3 Unauthorized configuration changes must be investigated as potential security incidents.
6.4 Drift from security baseline: Remediate within 72 hours (treat as High severity vulnerability).
6.5 Drift from operational baseline (non-security): Remediate within 7 days.

7. CHANGE MANAGEMENT
All changes to production system configurations must follow the Change Management Policy. Emergency changes that bypass the standard process must be documented and reviewed within 24 hours.

8. ROLES AND RESPONSIBILITIES
- IT/DevOps: Define and implement baselines; operate IaC; respond to drift alerts.
- Security Team: Define baseline security requirements; review IaC; investigate unauthorized changes.
- System Owners: Ensure systems comply with baselines; not make manual production changes.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "supply-chain-risk",
    title: "Supply Chain Risk Management Policy",
    category: "risk",
    description: "Controls for managing cybersecurity risk from software, hardware, and service suppliers including SBOM, vendor assessments, and CMMC SR domain requirements.",
    content: `SUPPLY CHAIN RISK MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for identifying, assessing, and managing cybersecurity risks introduced through [Organization Name]'s supply chain. This policy addresses CMMC SR.1.016/SR.2.004, NIST SP 800-161, and FedRAMP SA-12.

2. SCOPE
This policy applies to all third-party software (commercial, open source, SaaS), hardware, and services that are integrated into or support [Organization Name]'s production systems.

3. SUPPLIER INVENTORY
3.1 [Organization Name] must maintain a current inventory of all suppliers providing software, hardware, managed security services, IT services, or cloud platforms critical to production operations.
3.2 Suppliers must be classified by criticality tier:
- Critical: Suppliers whose failure or compromise could directly affect the security or availability of the production platform or client data
- Important: Suppliers whose disruption would significantly impact operations
- Standard: Suppliers with limited impact if disrupted
3.3 The supplier inventory must be reviewed and updated at minimum annually.

4. PRE-PROCUREMENT SECURITY ASSESSMENT
4.1 Before procuring a new Critical or Important supplier, a security assessment must be completed.
4.2 The assessment must review: the supplier's SOC 2 Type II report (or equivalent), their data handling and privacy practices, their incident notification obligations, and their business continuity capabilities.
4.3 For suppliers processing Restricted or CUI data, additional requirements apply: FedRAMP authorization or equivalent, ability to execute a DPA, and no ownership or operations in countries designated as high-risk.

5. CONTRACTUAL SECURITY REQUIREMENTS
All contracts with Critical and Important suppliers must include:
- Security and data protection obligations equivalent to [Organization Name]'s own standards
- Right to audit provisions
- Incident notification requirements (supplier must notify within 72 hours of a security incident affecting us)
- Right to terminate for cause if supplier fails to meet security obligations

6. SOFTWARE BILL OF MATERIALS (SBOM)
6.1 [Organization Name] must maintain a Software Bill of Materials (SBOM) for all production software, including commercial, open source, and transitive dependencies.
6.2 The SBOM must be reviewed against known vulnerability databases at minimum monthly.
6.3 Open source components must be assessed for: known CVEs, license compatibility, maintenance status, and supply chain risks.

7. PROHIBITED SUPPLIERS
7.1 [Organization Name] maintains a prohibited supplier list based on U.S. government sanctions lists and National Security threat designations.
7.2 Software, hardware, or services from prohibited suppliers must not be used in production environments without explicit CISO and legal approval.

8. ONGOING MONITORING
8.1 Critical suppliers must be reviewed annually (updated SOC 2 report, news monitoring, threat intelligence).
8.2 Security incidents at Critical suppliers must trigger an immediate review of potential impact.

9. ROLES AND RESPONSIBILITIES
- Procurement/Legal: Ensure security requirements are in supplier contracts; maintain supplier inventory.
- Security Team: Define security requirements; conduct security assessments; maintain prohibited supplier list.
- Engineering: Maintain SBOM; monitor dependencies for vulnerabilities.

Policy Owner: [CISO / Procurement Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "contingency-planning",
    title: "Contingency Planning Policy",
    category: "risk",
    description: "Disaster recovery planning, system criticality tiers, RTO/RPO targets, and DR test requirements. Satisfies CMMC CP.2.001, FedRAMP CP-1 through CP-9, SOC 2 A1.2.",
    content: `CONTINGENCY PLANNING POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for planning, implementing, and testing business continuity and disaster recovery capabilities to ensure [Organization Name] can maintain or rapidly restore critical operations following disruption. This policy satisfies CMMC CP.2.001, FedRAMP CP-1 through CP-9, and SOC 2 A1.2.

2. SCOPE
This policy applies to all production systems, infrastructure, and business processes operated by or supporting [Organization Name].

3. CONTINGENCY PLANNING PROGRAM
3.1 [Organization Name] must maintain a documented Contingency Plan that includes: a Business Impact Analysis (BIA), system criticality tiers with RTO/RPO targets, contingency procedures for each tier, contact lists, alternate processing procedures, and recovery procedures.
3.2 The Contingency Plan must be reviewed and updated annually and following any significant change to systems, personnel, or operations.

4. BUSINESS IMPACT ANALYSIS (BIA)
4.1 A BIA must be conducted to identify: critical business processes and their supporting IT systems, dependencies between systems, the impact of disruption over time, and the maximum tolerable downtime.
4.2 BIA outputs determine system criticality tiers and RTO/RPO targets (see Backup & Recovery Policy for tiered targets).
4.3 The BIA must be reviewed annually.

5. ALTERNATE PROCESSING AND SITE RECOVERY
5.1 For Tier 1 (Critical) systems: Alternate processing capability must be maintained at all times via geographic redundancy. Failover must occur automatically or with minimal manual intervention.
5.2 For Tier 2 (Important) systems: Documented manual failover procedures to an alternate environment must be maintained.
5.3 [Organization Name] must not have all critical processing capability in a single geographic location.

6. CONTINGENCY PLAN TESTING
6.1 The Contingency Plan must be tested at minimum annually:
- Tabletop Exercise (at minimum annually): Walk through a hypothetical disaster scenario with key personnel; identify gaps; update plan.
- Partial Failover Test (at minimum annually): Actually restore a representative subset of systems/data from backup to an alternate environment and verify functionality.
- Full Failover Test (at minimum every 2 years for Tier 1 systems): Simulate complete loss of primary environment; execute full recovery; measure actual vs. target RTO/RPO.
6.2 Test results must be documented and presented to executive leadership.
6.3 Corrective actions from test failures must be remediated and verified before the next test.

7. COMMUNICATION DURING A CONTINGENCY
7.1 The Contingency Plan must include an out-of-band communication plan for when primary systems (email, Slack) are unavailable.
7.2 Client notification procedures must specify: what triggers client notification, who communicates to clients, the timeline for notification, and the content of communications.

8. PLAN MAINTENANCE
The Contingency Plan must be updated within 30 days following: a real contingency event, a test that identifies significant gaps, significant system or operational changes, or key personnel changes.

9. ROLES AND RESPONSIBILITIES
- CISO: Own the contingency program; present test results to leadership.
- IT/DevOps: Implement redundancy and backup infrastructure; conduct technical recovery exercises.
- Business Continuity Lead: Coordinate BIA; facilitate tabletop exercises; maintain the plan.

Policy Owner: [CISO / Business Continuity Lead]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "personnel-security",
    title: "Personnel Security Policy",
    category: "hr",
    description: "Background screening requirements, security clearance management, and insider threat procedures for personnel with access to sensitive systems.",
    content: `PERSONNEL SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for ensuring that individuals granted access to [Organization Name] systems and data are appropriately screened, trustworthy, and aware of their security responsibilities. Personnel security addresses one of the most significant risk vectors: the insider threat.

2. SCOPE
This policy applies to all employees, contractors, and consultants at all levels, with requirements scaled to the sensitivity of systems and data accessed.

3. BACKGROUND SCREENING
3.1 All personnel who will access Internal, Confidential, or Restricted data must complete a background check before access is granted.
3.2 Screening components by role sensitivity:

Standard roles (all personnel accessing Internal data or above):
- Criminal history (7-year lookback, all counties of residence)
- Employment history verification (3 prior employers)
- Education verification (highest claimed degree)
- Identity verification (government-issued ID)

Elevated roles (access to Confidential data, privileged accounts, or client-facing roles):
- All of the above plus:
- Credit history check (where legally permitted and proportionate to role)
- Reference checks (minimum 2 professional references)

Federal/CUI roles (access to CUI, federal contracts, or FedRAMP systems):
- All standard and elevated checks plus:
- Eligibility for access to federal information as required by the applicable contract
- Ongoing periodic screening as required by contract terms

3.3 Adverse findings are reviewed by HR with input from Legal; they do not automatically disqualify a candidate.

4. SECURITY CLEARANCE MANAGEMENT (IF APPLICABLE)
4.1 Employees who require government security clearances for federal contracts must initiate clearance investigations through the appropriate government channel.
4.2 [Organization Name] must maintain accurate records of clearance levels, clearance expiry, and sponsoring contracts for all cleared personnel.
4.3 Changes in circumstances that may affect clearance eligibility must be self-reported to the Security Officer.

5. INSIDER THREAT PROGRAM
5.1 All personnel must complete insider threat awareness training as part of annual security training.
5.2 Personnel must report concerns about colleague behavior that may indicate a security threat.
5.3 HR, Legal, and Security must coordinate the investigation of insider threat concerns.
5.4 Privileged access must be proactively reduced or revoked when indicators of insider threat are identified, pending investigation.

6. ONGOING PERSONNEL SECURITY
6.1 Personnel with access to Restricted or CUI data must be subject to periodic re-screening every 5 years.
6.2 Personnel are obligated to self-report: arrests, criminal charges, court proceedings, financial distress that may create coercion risk, and any other circumstances that might affect their ability to maintain security obligations.

7. ROLES AND RESPONSIBILITIES
- HR: Manage background check process; maintain screening records; handle adjudication.
- Security Team: Define screening requirements; manage insider threat program; respond to concerns.
- All Personnel: Report security concerns; self-report significant life changes.

Policy Owner: [HR Director / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "security-authorization",
    title: "Security Assessment & Authorization Policy",
    category: "operations",
    description: "Governs the authorization process for information systems to operate, including ATO lifecycle, continuous monitoring, and POA&M management. Required for FedRAMP CA controls.",
    content: `SECURITY ASSESSMENT & AUTHORIZATION POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for assessing the security posture of [Organization Name]'s information systems, authorizing them to operate, and continuously monitoring their compliance posture. This policy satisfies FedRAMP CA-1 through CA-7, FISMA, and CMMC CA.2.157.

2. SCOPE
This policy applies to all information systems operated by [Organization Name] that host, process, or transmit federal data or are subject to formal authorization requirements.

3. SYSTEM AUTHORIZATION LIFECYCLE
All in-scope systems must complete the Authorization lifecycle before being used to process Restricted or CUI data:
- Phase 1 - Prepare: Define the authorization boundary; complete the System Security Plan (SSP); categorize the system (FIPS 199 for FedRAMP); select applicable controls.
- Phase 2 - Assess: Conduct a Security Assessment by a qualified assessor; document findings in a Security Assessment Report (SAR).
- Phase 3 - Authorize: Submit the Authorization Package (SSP + SAR + POA&M) to the Authorizing Official (AO); receive the Authority to Operate (ATO).
- Phase 4 - Monitor: Maintain continuous monitoring; report significant changes; maintain the POA&M.

4. SYSTEM SECURITY PLAN (SSP)
4.1 A SSP must be developed and maintained for all systems subject to this policy.
4.2 The SSP must describe: the system purpose and architecture, authorization boundary and data flows, applicable controls and how each is implemented, and system interconnections.
4.3 The SSP must be updated within 30 days of significant changes to the system.

5. SECURITY ASSESSMENT
5.1 A full security assessment must be conducted at minimum every 3 years.
5.2 Annual assessments of a subset of controls must be conducted in years between full assessments.
5.3 For FedRAMP: assessments must be conducted by a FedRAMP-recognized Third-Party Assessment Organization (3PAO).

6. PLAN OF ACTION AND MILESTONES (POA&M)
6.1 All assessment findings that are not immediately remediated must be tracked in the POA&M.
6.2 The POA&M must be reviewed and updated monthly. Progress must be reported to the Authorizing Official quarterly.
6.3 High-risk findings must have remediation scheduled within 90 days; Critical findings within 30 days.

7. CONTINUOUS MONITORING (CONMON)
7.1 Continuous monitoring activities must occur on the following schedule:
- Ongoing: Automated vulnerability scanning, configuration monitoring, log analysis
- Monthly: Review scan results; update POA&M; assess security control effectiveness
- Annually: Review all security controls; update SSP
7.2 Significant changes to the system must trigger a significant change assessment before the change is implemented in production.

8. ROLES AND RESPONSIBILITIES
- CISO: Serve as (or designate) the Authorizing Official for internal systems; oversee the authorization program.
- Security Team: Develop SSP; coordinate assessments; maintain POA&M; conduct ConMon.
- System Owners: Provide system information for SSP; implement security controls; report significant changes.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "api-security",
    title: "API Security Policy",
    category: "security",
    description: "Security standards for API design, authentication, rate limiting, input validation, and OWASP API Top 10 compliance.",
    content: `API SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for Application Programming Interfaces (APIs) designed, developed, and maintained by [Organization Name]. APIs are a primary attack surface for modern applications; securing them is essential to protecting client data and system integrity.

2. SCOPE
This policy applies to all APIs developed by [Organization Name] for internal use, client access, partner integrations, or public consumption, including REST APIs, GraphQL APIs, gRPC services, and webhooks.

3. AUTHENTICATION AND AUTHORIZATION
3.1 All API endpoints that access organizational or client data must require authentication. Unauthenticated endpoints must be explicitly approved by the Security team and restricted to non-sensitive, truly public data.
3.2 Approved authentication mechanisms:
- OAuth 2.0 with PKCE: For user-facing flows where tokens are issued to clients
- JWT (JSON Web Tokens): Must be signed with RS256 or ES256; HS256 is prohibited for production APIs. Access tokens: 15-60 minute expiry; refresh tokens: 24 hours with rotation
- API keys: For server-to-server integration only; must be treated as secrets; must never be exposed in frontend code or version control
3.3 All API requests must be authorized against the calling user/service's permissions server-side.
3.4 Object-level authorization must be enforced for every object access - verify that the requesting user is permitted to access the specific object (OWASP API Security: Broken Object Level Authorization is the most common API vulnerability).

4. INPUT VALIDATION AND OUTPUT ENCODING
4.1 All API inputs must be validated for: expected data type, format, length, and allowable values.
4.2 SQL queries must use parameterized queries or prepared statements exclusively; dynamic SQL construction with user input is prohibited.
4.3 API responses must not expose internal system information: stack traces, database error messages, or framework version information must not appear in error responses.

5. RATE LIMITING AND ABUSE PREVENTION
5.1 All public and partner-facing API endpoints must implement rate limiting per IP address and per authenticated user/token.
5.2 Authentication endpoints (login, token refresh, password reset) must have stricter rate limits.
5.3 Account lockout or exponential backoff must be implemented for authentication failures.

6. TRANSPORT SECURITY
6.1 All API traffic must be transmitted over TLS 1.2 or higher. HTTP (non-TLS) is not permitted for any API endpoint.
6.2 API endpoints must enforce HTTPS and redirect or reject HTTP connections.

7. API INVENTORY AND DOCUMENTATION
7.1 All APIs must be documented in the organization's API registry including: purpose, owner, consumers, authentication mechanism, and data classification of data accessed.
7.2 Undocumented or "shadow" APIs must be identified through API discovery scanning and either documented or decommissioned.

8. API SECURITY TESTING
8.1 All new APIs and significant changes must undergo security testing before production release:
- Automated DAST scanning as part of CI/CD
- Manual security review for APIs accessing Restricted/CUI data or implementing authentication/authorization logic
8.2 APIs must be included in scope for the organization's annual penetration test.
8.3 OWASP API Security Top 10 must be used as a minimum testing checklist.

9. VERSIONING AND DEPRECATION
9.1 APIs must be versioned; breaking changes must be deployed as a new version, not in-place.
9.2 Deprecated versions must be decommissioned within 6 months of the replacement version GA.

10. ROLES AND RESPONSIBILITIES
- Engineering: Design and implement APIs per this policy; include security testing in CI/CD.
- Security Team: Define API security requirements; conduct security reviews; monitor for API abuse.

Policy Owner: [CISO / Head of Engineering]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "responsible-disclosure",
    title: "Responsible Disclosure & Vulnerability Reporting Policy",
    category: "security",
    description: "Safe harbor and process for external security researchers to report vulnerabilities, including scope, response timelines, and disclosure coordination.",
    content: `RESPONSIBLE DISCLOSURE & VULNERABILITY REPORTING POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Public

1. PURPOSE
[Organization Name] values the security research community and recognizes that independent security researchers play an important role in identifying vulnerabilities. This policy provides clear guidance for reporting security vulnerabilities to us in good faith and establishes safe harbor protections for researchers who comply.

2. SYSTEMS IN SCOPE
The following are in scope for responsible disclosure:
- The EnterpriseComply web application and API (app.enterprisecomply.com)
- Public-facing documentation and marketing sites
- Authentication flows and session management

OUT OF SCOPE:
- Social engineering of [Organization Name] employees or contractors
- Physical attacks on [Organization Name] facilities
- Denial of service (DoS/DDoS) attacks
- Automated scanning that generates significant load on production systems
- Third-party services or infrastructure not operated by [Organization Name]
- Vulnerabilities in software we do not maintain (report directly to the software vendor)

3. HOW TO REPORT
3.1 Please report vulnerabilities via email to: security@colorcodesolutions.com
3.2 Include in your report:
- Vulnerability type and description
- Step-by-step reproduction instructions
- Proof of concept (screenshots, video, request/response pairs)
- Potential impact of the vulnerability
- Your name/handle (optional - anonymous reports accepted)
3.3 Do not publicly disclose the vulnerability before we have had a reasonable opportunity to remediate it.

4. WHAT TO EXPECT FROM US
- Acknowledgment: We will acknowledge receipt within 2 business days.
- Assessment: We will assess and classify the vulnerability within 5 business days and communicate our assessment.
- Updates: We will provide status updates every 7 days while the vulnerability is under investigation or remediation.
- Credit: With your permission, we will acknowledge you in our security acknowledgments for valid, unique vulnerabilities.

5. SAFE HARBOR
We will not pursue legal action against researchers who:
- Report vulnerabilities in good faith per this policy
- Do not access, modify, or exfiltrate data beyond the minimum necessary to demonstrate the vulnerability
- Do not destroy, corrupt, or degrade our systems
- Do not impact the availability of our services or violate the privacy of our customers
- Immediately stop testing and notify us upon discovering any customer data

6. SEVERITY AND RESPONSE TIMELINES
After classification, we target the following remediation timelines:
- Critical: 15 days
- High: 30 days
- Medium: 90 days
- Low: 180 days

We may request a coordinated disclosure embargo while remediation is in progress. We ask that researchers respect a maximum 90-day disclosure window from initial report.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "zero-trust",
    title: "Zero Trust Architecture Policy",
    category: "security",
    description: "Governs implementation of never-trust-always-verify principles across identity, device, network, application, and data security domains.",
    content: `ZERO TRUST ARCHITECTURE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s commitment to and requirements for implementing Zero Trust Architecture (ZTA) principles. Zero Trust rejects the assumption of implicit trust based on network location and replaces it with continuous, context-aware verification of every access request. ZTA aligns with NIST SP 800-207, CISA Zero Trust Maturity Model, and FedRAMP requirements for modern authorization.

2. SCOPE
This policy applies to all systems, users, devices, and data flows within [Organization Name]'s IT environment.

3. ZERO TRUST PRINCIPLES
3.1 Verify Explicitly: Every access request must be authenticated and authorized using all available data points: user identity, device health, location, service/workload, data classification, and anomaly signals. No user or device is implicitly trusted based on network location.

3.2 Least Privilege Access: Access is granted with the minimum permissions necessary for the specific task, for the minimum duration necessary. Just-in-time and just-enough-access approaches are preferred for privileged operations.

3.3 Assume Breach: Design and operate systems assuming that attackers are already present in the environment. Segment access, minimize blast radius, implement end-to-end encryption, and use monitoring to detect lateral movement.

4. IDENTITY VERIFICATION
4.1 Multi-factor authentication (MFA) is mandatory for all user access; see the MFA Policy. MFA must be phishing-resistant (TOTP minimum; FIDO2/passkeys strongly preferred for privileged access).
4.2 User accounts must be continuously evaluated against risk signals: unusual location, impossible travel, unusual access patterns, or device anomalies must trigger step-up authentication or session termination.
4.3 Service and machine identities must be managed using short-lived certificates or workload identity federation, not long-lived shared secrets.

5. DEVICE HEALTH VERIFICATION
5.1 Access to organizational resources must evaluate device health before granting access: OS patch level, antivirus/EDR status, disk encryption status, and MDM enrollment.
5.2 Non-compliant devices must be blocked from accessing Confidential or Restricted data.

6. NETWORK MICRO-SEGMENTATION
6.1 Network access must be granted to specific resources, not network segments.
6.2 Network micro-segmentation must be implemented using software-defined networking, security groups, or equivalent controls.
6.3 East-west traffic (internal service-to-service) must be encrypted and authenticated.

7. APPLICATION ACCESS
7.1 Applications must authenticate and authorize every request independently, not rely on network location as a trust signal.
7.2 Zero Trust Network Access (ZTNA) or an Identity-Aware Proxy must be used in preference to traditional VPN for accessing internal applications where technically feasible.

8. DATA PROTECTION
8.1 Data must be classified and protected based on its classification, not based on the network it traverses.
8.2 Data Loss Prevention (DLP) controls must be applied at the application and endpoint layer, independent of network perimeter.

9. CONTINUOUS MONITORING
9.1 Access patterns, anomalies, and policy violations must be monitored continuously.
9.2 Security analytics must aggregate signals from identity, device, network, and application layers to detect anomalous behavior.

10. ROLES AND RESPONSIBILITIES
- CISO: Own the Zero Trust strategy; maintain the maturity roadmap.
- IT/Security: Implement technical ZTA controls; operate ZTA tools.
- Engineering: Build applications to ZTA principles (verify explicitly, least privilege).

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "cookie-consent",
    title: "Cookie & Consent Management Policy",
    category: "data",
    description: "Cookie categories, consent banner requirements, user rights, and compliance obligations under GDPR, CCPA, and ePrivacy regulations.",
    content: `COOKIE & CONSENT MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy governs [Organization Name]'s use of cookies and similar tracking technologies on organizational websites and applications, and establishes requirements for obtaining and managing user consent in compliance with applicable privacy regulations including GDPR, ePrivacy Directive, and CCPA.

2. SCOPE
This policy applies to all [Organization Name] websites and web applications that use cookies, pixels, local storage, session storage, or similar tracking technologies.

3. COOKIE CATEGORIES
3.1 Strictly Necessary Cookies: Required for the website or application to function (e.g., session authentication, CSRF tokens, load balancing). Consent is not required for strictly necessary cookies.
3.2 Functional Cookies: Enable enhanced functionality and personalization (e.g., remembering user preferences, language settings). Consent is required.
3.3 Analytics/Performance Cookies: Collect information about how visitors use the site (e.g., page visits, error rates). Consent is required. Analytics data must be anonymized or pseudonymized where possible.
3.4 Marketing/Advertising Cookies: Track visitors across sites for advertising. Consent is required. Marketing cookies must not be used without explicit opt-in consent under GDPR.

4. CONSENT REQUIREMENTS
4.1 GDPR/ePrivacy (EU/UK visitors): Cookies other than strictly necessary require explicit opt-in consent before placement. Consent must be:
- Freely given (no pre-ticked boxes; no cookie wall blocking access to content)
- Specific (separate consent by cookie category)
- Informed (clear explanation of purpose)
- Unambiguous (affirmative action required; silence or scrolling does not constitute consent)
- Withdrawable (as easy to withdraw as to give)
4.2 CCPA (California visitors): Visitors must be informed of cookie use and offered a "Do Not Sell or Share My Personal Information" opt-out if any cookies share data with third parties for advertising purposes.
4.3 Consent records must be stored: date/time of consent, which categories were accepted, version of the consent notice, and user session identifier. Consent records must be retained for 3 years.

5. CONSENT MANAGEMENT PLATFORM (CMP)
5.1 [Organization Name] must implement an approved CMP on all public websites.
5.2 The CMP must: present a compliant consent banner on first visit, categorize all cookies in a clear preference center, honor consent choices, and record consent for audit purposes.

6. COOKIE INVENTORY
6.1 [Organization Name] must maintain a current inventory of all cookies set by organizational properties: cookie name, provider, purpose, category, duration, and whether first-party or third-party.
6.2 The cookie inventory must be reviewed and updated quarterly.

7. THIRD-PARTY COOKIES AND DATA SHARING
Third parties who receive data via cookies must be listed in the subprocessor register and must have executed appropriate data sharing agreements.

8. ROLES AND RESPONSIBILITIES
- Legal/Privacy: Define consent requirements; review CMP; advise on regulatory obligations.
- Marketing/Web: Implement CMP; maintain cookie inventory; request approval for new tracking.
- IT/Engineering: Ensure only approved cookies are set; implement consent enforcement.

Policy Owner: [DPO / Legal / Marketing]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "iot-security",
    title: "IoT & Connected Device Security Policy",
    category: "security",
    description: "Security controls for Internet of Things devices, operational technology, and other connected hardware used in organizational facilities or networks.",
    content: `IoT & CONNECTED DEVICE SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for Internet of Things (IoT) devices, operational technology (OT), and other connected devices used in [Organization Name] facilities or networks. IoT devices often have limited security capabilities and represent a growing attack surface.

2. SCOPE
This policy applies to all network-connected devices that are not general-purpose computers, including: smart building controls, environmental sensors, IP cameras, badge readers, smart TVs, printers, connected conference room equipment, and any other embedded or purpose-built connected devices.

3. DEVICE PROCUREMENT AND APPROVAL
3.1 IoT/OT devices must be reviewed by IT Security before procurement and deployment.
3.2 Procurement criteria:
- The vendor must have a documented vulnerability disclosure and patch process
- The device must support firmware updates throughout its expected operational life
- The device must support strong authentication (not only default credentials)
3.3 IoT devices must be inventoried at procurement and tracked in the asset management system.

4. NETWORK SEGMENTATION
4.1 IoT devices must be isolated on dedicated network segments (VLANs) separate from:
- Corporate IT networks (employee workstations and servers)
- Production systems and cloud infrastructure
- Guest/visitor networks
4.2 IoT VLANs must have firewall rules that: block IoT-to-corporate traffic by default, limit IoT internet access to required cloud management endpoints only, and block all traffic from the corporate network to IoT devices that is not required for management.

5. HARDENING
5.1 Default credentials must be changed on all IoT devices before deployment.
5.2 Unnecessary services, features, and open ports must be disabled where the device permits.
5.3 Remote management interfaces must be secured: use HTTPS/SSH only, disable Telnet.
5.4 IoT devices must have their firmware updated to the latest available version before deployment.

6. PATCH AND FIRMWARE MANAGEMENT
6.1 Firmware updates for IoT devices must be monitored via vendor security advisories.
6.2 Critical firmware updates must be applied within 30 days of availability.
6.3 IoT devices for which the vendor no longer provides security updates must be isolated with additional compensating controls or replaced.

7. MONITORING
7.1 IoT network segments must be monitored for anomalous behavior: unexpected outbound connections, unusual traffic volumes, connections to known malicious destinations.
7.2 New devices appearing on IoT network segments must generate alerts; unknown device alerts must be investigated within 4 hours.

8. ROLES AND RESPONSIBILITIES
- IT/Facilities: Manage IoT device inventory and network segmentation; apply firmware updates.
- Security Team: Define security requirements; monitor IoT network segments.
- Procurement: Screen IoT devices against this policy before purchase.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "board-cybersecurity",
    title: "Board-Level Cybersecurity Governance Policy",
    category: "operations",
    description: "CISO reporting cadence to board, board oversight responsibilities, cyber risk appetite, and executive governance of the information security program.",
    content: `BOARD-LEVEL CYBERSECURITY GOVERNANCE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Confidential

1. PURPOSE
This policy establishes the governance structure, oversight responsibilities, and reporting requirements for cybersecurity at the executive and board level. This policy implements cybersecurity oversight requirements of the SEC Cybersecurity Rules (for public companies), NIST CSF Govern function, and SOC 2 CC1.2.

2. SCOPE
This policy applies to [Organization Name]'s Board of Directors (or equivalent governing body), Executive Leadership Team, and the CISO/Security Lead.

3. BOARD OVERSIGHT RESPONSIBILITIES
3.1 The Board is responsible for:
- Understanding the organization's cyber risk exposure and appetite at a strategic level
- Ensuring adequate resources are allocated to the information security program
- Receiving and reviewing cybersecurity status reports from the CISO
- Approving the organization's cyber risk appetite statement
- Overseeing significant cybersecurity investments and initiatives
- Ensuring that material cybersecurity incidents are disclosed appropriately
3.2 At least one board member or committee must have cybersecurity expertise, or the board must retain access to cybersecurity expertise through advisors.

4. CISO REPORTING TO BOARD
4.1 The CISO must present a cybersecurity status report to the Board or a Board committee at minimum quarterly.
4.2 Quarterly reports must include at minimum:
- Current overall security posture score and trend (improving/stable/declining)
- Status of active security incidents and their resolution
- Top risk register items and remediation progress
- Compliance status against applicable frameworks (CMMC, SOC 2, FedRAMP)
- Security awareness training completion rates
- Vulnerability management summary (open Critical/High, trend)
4.3 The annual CISO report to the Board must also include:
- Annual security assessment results
- Year-over-year program maturity comparison
- Proposed security program budget and priorities for the next year
- External threat landscape summary

5. CYBER RISK APPETITE
5.1 The Board must formally approve a Cyber Risk Appetite Statement.
5.2 The risk appetite must be reviewed and reconfirmed annually by the Board.
5.3 Material deviations from the risk appetite must be escalated to the Board for explicit acceptance or direction.

6. SIGNIFICANT CHANGE NOTIFICATION
6.1 The CISO must notify the Board Chair within 24 hours of:
- A confirmed data breach or cybersecurity incident that is material
- Discovery of a Critical vulnerability in production systems that is being actively exploited
- A significant security failure with material business impact
6.2 The full board must be notified within 5 business days of any of the above events.

7. BOARD MEMBER SECURITY EDUCATION
Board members must receive cybersecurity awareness briefings at minimum annually covering: current threat landscape, social engineering targeting executives (CEO fraud, BEC), and their oversight responsibilities.

8. ROLES AND RESPONSIBILITIES
- Board of Directors: Provide oversight; review reports; approve risk appetite; ensure adequate resources.
- CISO: Report security posture; escalate material incidents; implement board direction.
- CEO/Executive Team: Resource the security program; model security-conscious behavior.

Policy Owner: [CEO / Board Chair / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "mfa-policy",
    title: "Multi-Factor Authentication (MFA) Policy",
    category: "security",
    description: "Mandatory MFA requirements for all organizational systems, approved MFA methods, exceptions process, and enforcement. Highest urgency per remediation plan. Satisfies CMMC IA.3.083, FedRAMP IA-2(1), SOC 2 CC6.1.",
    content: `MULTI-FACTOR AUTHENTICATION (MFA) POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal
Priority: HIGHEST - This policy must be implemented before any client data is processed.

1. PURPOSE
This policy mandates multi-factor authentication (MFA) for all access to [Organization Name] systems and establishes the approved methods, enrollment requirements, and exception process. MFA is the single most effective defense against credential-based attacks, which account for the majority of successful breaches. MFA is required by CMMC IA.3.083, FedRAMP IA-2(1) and IA-2(2), and SOC 2 CC6.1. Failure to enforce MFA invalidates all three framework assessments.

2. SCOPE
This policy applies universally to all accounts - employees, contractors, consultants, administrators, and service accounts with interactive login capability - that access any [Organization Name] system, application, or data.

3. MFA REQUIREMENT
MFA is mandatory for ALL of the following:
- The EnterpriseComply platform (all roles: admin, compliance manager, auditor, viewer)
- Cloud management consoles (AWS, Azure, GCP - all users without exception)
- Corporate email and productivity suite
- VPN access
- Version control and CI/CD systems
- Administrative and privileged interfaces
- Any system accessing Confidential or Restricted data
- Third-party and contractor accounts with access to any of the above

There are no exceptions based on role, seniority, or technical difficulty. The Administrator account must be the first account with MFA enabled.

4. APPROVED MFA METHODS (IN ORDER OF PREFERENCE)
4.1 FIDO2 / Passkeys / Hardware Security Keys (e.g., YubiKey): Most secure. Phishing-resistant. Preferred for all privileged accounts and administrator accounts. Resistant to SIM swapping, real-time phishing, and adversary-in-the-middle attacks.

4.2 TOTP Authenticator App (e.g., Google Authenticator, Authy, Microsoft Authenticator, 1Password): Strongly preferred for all standard accounts. Works offline. Not phishing-resistant but significantly more secure than SMS. This is the minimum acceptable method for production system access.

4.3 Push Notification (e.g., Duo Push, Microsoft Authenticator push): Acceptable but susceptible to MFA fatigue attacks; push notification fatigue controls (number matching, geographic context) must be enabled where available.

4.4 SMS one-time passwords: PROHIBITED for new implementations. SMS OTP is vulnerable to SIM swapping and SS7 attacks and does not meet phishing-resistant MFA requirements under CMMC IA.3.083. Existing SMS MFA must be migrated to TOTP or FIDO2 within 90 days of this policy's effective date.

4.5 Email-based OTP: PROHIBITED. Email OTP creates a circular dependency - if the email account is compromised, MFA provides no additional protection.

5. MFA ENROLLMENT REQUIREMENTS
5.1 MFA must be enrolled before first access to any production system. No grace period is permitted.
5.2 All users must enroll a primary MFA method and at least one backup MFA method or backup codes.
5.3 Backup codes must be stored securely (password manager or printed and stored in a secure location). Backup codes must not be stored on the same device as the primary MFA method.
5.4 For the administrator account: hardware security key enrollment is strongly recommended.

6. ORG-WIDE MFA ENFORCEMENT
6.1 The organization-wide MFA enforcement setting in the EnterpriseComply platform must be enabled. This setting blocks platform access for any user who has not completed TOTP enrollment.
6.2 Cloud IAM policies must be configured to require MFA for all console access and for all API access that modifies IAM or security settings.

7. RECOVERY AND ACCOUNT LOCKOUT
7.1 MFA recovery (for lost authenticator app, lost hardware key, lost phone) must require identity verification through an out-of-band channel (video call with IT, in-person verification, or pre-registered recovery email/phone).
7.2 Recovery must never be performed solely via email, as a compromised email account is the most common precursor to account takeover.
7.3 MFA resets performed by IT must be logged and reviewed monthly.

8. PHISHING-RESISTANT MFA FOR PRIVILEGED ACCOUNTS
All accounts with administrative/privileged access to production systems must use phishing-resistant MFA (FIDO2/hardware key or equivalent) within 180 days of this policy's effective date.

9. EXCEPTIONS
9.1 No exceptions to MFA are permitted for accounts accessing production systems or Confidential/Restricted data.
9.2 For accounts with no interactive login (service accounts, automated processes), MFA does not apply to the authentication mechanism but equivalent controls must be in place.
9.3 Any request to exempt a production account from MFA requires written approval from the CISO and CEO, must document compensating controls, and must be reviewed monthly.

10. NON-COMPLIANCE
Accounts that have not enrolled MFA within required timeframes will have access suspended by IT. Administrators who do not enroll MFA will have elevated privileges reduced to standard user level until enrollment is complete.

Policy Owner: [CISO]
Effective Date: [DATE - IMMEDIATE EFFECT]
Next Review: [DATE]`,
  },
  {
    key: "privileged-access",
    title: "Privileged Access Management Policy",
    category: "security",
    description: "Controls for provisioning, securing, auditing, and revoking privileged and administrative access. Satisfies CMMC AC.2.006, FedRAMP AC-6(5), SOC 2 CC6.3.",
    content: `PRIVILEGED ACCESS MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for managing accounts with elevated privileges that, if compromised, would give an attacker broad access to organizational systems and data. This policy satisfies CMMC AC.2.006/IA.3.083, FedRAMP AC-6(5), and SOC 2 CC6.3.

2. SCOPE
This policy applies to all accounts with elevated privileges, including: operating system administrators, cloud IAM administrators, database administrators, network device administrators, security tool administrators, CISO, and application super administrators.

3. MINIMUM COUNT AND ACCOUNTABILITY
3.1 Super Administrator / highest-privilege access must be limited to a maximum of 2 named individuals. Both must be documented with personal accountability.
3.2 All privileged accounts must be assigned to specific named individuals. Shared privileged accounts are prohibited.
3.3 A Privileged Accounts Register must be maintained listing: account identifier, privilege level, assigned individual, business justification, approver, provisioning date, and last review date.

4. SEPARATE PRIVILEGED ACCOUNTS
4.1 Individuals with both standard and privileged access must use separate accounts for each: a standard account for day-to-day work, and a separate privileged account for administrative tasks.
4.2 Privileged accounts must not be used for general business activities (reading email, browsing, etc.).
4.3 Privileged accounts should use a hardware security key (FIDO2) per the MFA Policy.

5. JUST-IN-TIME (JIT) ACCESS
5.1 Where technically feasible, permanent privileged access must be replaced with just-in-time access: privileges are elevated only for the duration of the specific task and then revoked automatically.
5.2 JIT access requests must be logged: requestor, privilege requested, system, time, duration, and business justification.
5.3 Emergency privileged access (break-glass access) must follow a documented procedure and must be immediately logged and reviewed by the CISO.

6. PROVISIONING PRIVILEGED ACCESS
6.1 Provisioning of any privileged account requires approval from the CISO in addition to the manager.
6.2 New privileged accounts must be documented in the Privileged Accounts Register before access is activated.
6.3 Privileged access must never be provisioned based on verbal approval; written approval is required.

7. PRIVILEGED ACCOUNT MONITORING AND AUDITING
7.1 All actions performed using privileged accounts must be logged. Logs must include: account used, timestamp, action performed, and affected resources.
7.2 Privileged account logs must be forwarded to the SIEM and protected against modification by the privileged account holder.
7.3 Privileged account activity must be reviewed weekly by the Security team.
7.4 Alerts must be configured for: privileged account login outside business hours, creation or deletion of privileged accounts, and changes to audit logging configurations.

8. ACCESS REVIEWS
8.1 Privileged accounts must be reviewed quarterly. Reviews must confirm: the individual still requires privileged access, the access level is still appropriate, and MFA is enrolled using the required method.
8.2 Privileged access that cannot be justified must be removed within 5 business days.

9. DEPROVISIONING
9.1 All privileged accounts for departing personnel must be revoked immediately (within 1 hour for involuntary departures).
9.2 Privileged account credentials must be rotated after the departure of any individual who had access to shared infrastructure credentials.

10. ROLES AND RESPONSIBILITIES
- CISO: Approve privileged access; review weekly audit logs; own the Privileged Accounts Register.
- IT/Security: Implement JIT access controls; configure logging; conduct quarterly reviews.
- Privileged Account Holders: Use privileged accounts only for authorized tasks; report security concerns.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "endpoint-security",
    title: "Endpoint Security Policy",
    category: "security",
    description: "Security requirements for workstations, laptops, mobile devices, and servers including EDR, full disk encryption, MDM, and removable media controls. Satisfies CMMC MP.2.120, FedRAMP SC-28, SOC 2 CC6.8.",
    content: `ENDPOINT SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for all endpoint devices - workstations, laptops, mobile devices, and servers - used by [Organization Name] to prevent malware infection, data loss, and unauthorized access. This policy satisfies CMMC MP.2.120/SI.1.210, FedRAMP SC-28/SI-3, and SOC 2 CC6.8.

2. SCOPE
This policy applies to all endpoints used to access organizational systems or data: corporate-owned desktops, laptops, mobile devices, servers (physical and virtual), and approved BYOD devices.

3. ENDPOINT DETECTION AND RESPONSE (EDR)
3.1 All corporate-managed endpoints (workstations, laptops, servers) must have an approved EDR solution installed and actively running.
3.2 EDR must provide: real-time malware detection, behavioral monitoring, threat hunting capability, automated response to known threats, and forensic logging.
3.3 EDR agents must not be disabled or tampered with. Requests to temporarily disable EDR require written approval from the CISO and must be time-limited.
3.4 EDR alerts at High or Critical severity must be reviewed within 2 hours and investigated within 4 hours.

4. FULL DISK ENCRYPTION
4.1 Full disk encryption must be enabled on all portable endpoints (laptops, mobile devices) and on workstations that store Confidential or Restricted data.
4.2 Approved disk encryption technologies:
- Windows: BitLocker with TPM (minimum AES-128; AES-256 preferred)
- macOS: FileVault 2
- Linux: LUKS (AES-256)
- Mobile: iOS and Android enforce device encryption by default; MDM must verify this is enabled
4.3 Encryption must be managed and verified via MDM or endpoint management platform.
4.4 Encryption recovery keys must be stored in an approved escrow (MDM or secrets manager), not on the device itself.

5. MOBILE DEVICE MANAGEMENT (MDM)
5.1 All mobile devices and laptops used to access organizational resources must be enrolled in [Organization Name]'s MDM solution before access is permitted.
5.2 MDM must enforce: screen lock PIN/biometric, automatic screen lock after 5 minutes, full device encryption, EDR enrollment where applicable, and approved software catalog.
5.3 Non-compliant devices (MDM violations, missing encryption, unapproved OS version) must be automatically blocked from accessing organizational resources until compliant.

6. MALWARE PREVENTION
6.1 In addition to EDR, traditional anti-malware protection must be maintained on Windows endpoints.
6.2 Email security gateway with attachment sandboxing and URL filtering must be configured to scan all inbound email.
6.3 Web proxy or DNS filtering must block access to known malicious domains from all endpoints.
6.4 Macro execution in Office documents must be disabled by default.

7. PATCH MANAGEMENT
7.1 OS and software patches must be applied per the Patch Management Policy SLAs.
7.2 MDM must enforce OS update requirements; endpoints running end-of-life OS versions must be blocked from accessing organizational resources.

8. APPLICATION CONTROL
8.1 Only approved applications may be installed on corporate-managed endpoints.
8.2 Application whitelisting must be implemented on servers; servers must run only approved, necessary applications.

9. INCIDENT RESPONSE FOR ENDPOINT COMPROMISE
9.1 Any endpoint suspected of compromise must be immediately isolated from the network.
9.2 Compromised endpoints must not be returned to production use until forensic investigation is complete and the device is verified clean or reimaged from a trusted baseline.

10. ROLES AND RESPONSIBILITIES
- IT: Deploy and manage EDR, encryption, and MDM; apply patches; respond to endpoint alerts.
- Security Team: Define requirements; monitor EDR alerts; investigate incidents.
- All Employees: Not disable security software; report unusual device behavior; return devices promptly upon request.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "data-breach-response",
    title: "Data Breach Response Policy",
    category: "security",
    description: "Detection, containment, investigation, notification, and post-incident procedures for data breaches and security incidents. Satisfies CMMC IR.2.092, SOC 2 CC7.3, GDPR Article 33.",
    content: `DATA BREACH RESPONSE POLICY
Version: 1.0 | Review Cycle: Semi-Annual | Classification: Internal

1. PURPOSE
This policy establishes procedures for detecting, containing, investigating, and notifying from data breaches and security incidents involving personal data or sensitive organizational data. This policy satisfies CMMC IR.2.092/IR.2.093, FedRAMP IR-1 through IR-6, SOC 2 CC7.3/CC7.4, and GDPR Article 33.

2. SCOPE
This policy applies to all incidents involving confirmed or suspected unauthorized access to, disclosure of, or loss of [Organization Name] or client data, whether caused by external attackers, insider actions, accidental exposure, or third-party breach.

3. INCIDENT CLASSIFICATION
Priority 1 - Critical:
- Confirmed unauthorized access to Restricted, CUI, or personal data of 500+ individuals
- Active ransomware with confirmed data exfiltration
- Credentials of privileged accounts compromised
Response: Incident Commander activated within 1 hour; external counsel and notification assessment within 4 hours.

Priority 2 - High:
- Suspected unauthorized access to Confidential or personal data (scope unclear)
- Internal account compromised (scope limited)
- Evidence of unauthorized access attempt with unknown outcome
Response: Security team response within 2 hours.

Priority 3 - Medium:
- Accidental internal disclosure of Confidential data to wrong internal recipient
- Minor unauthorized access to Internal data with no evidence of exfiltration
Response: Security team review within 8 business hours.

4. RESPONSE PROCEDURES

PHASE 1 - DETECTION AND REPORTING
4.1 Any employee who discovers or suspects a breach must report it immediately to security@[organization].com or via the incident hotline.
4.2 Initial triage determines: is this a confirmed incident? What systems and data are potentially affected? Is unauthorized access ongoing?

PHASE 2 - CONTAINMENT
4.3 Containment actions must be taken as rapidly as possible:
- Isolate affected systems from the network (while preserving forensic evidence)
- Disable compromised credentials and force password resets
- Block malicious IPs or domains at the network perimeter
- Revoke compromised API tokens or certificates
4.4 Forensic preservation must occur in parallel with containment.

PHASE 3 - INVESTIGATION
4.5 Root cause analysis must determine: how access was gained, what data was accessed or exfiltrated, when the breach began, and whether it is fully contained.
4.6 External incident response assistance must be engaged for Priority 1 incidents.

PHASE 4 - ERADICATION AND RECOVERY
4.7 Remove all attacker access, tools, and backdoors before restoring systems.
4.8 Restore systems from verified clean backups.
4.9 Verify system integrity before returning to production.

PHASE 5 - NOTIFICATION
5.1 REGULATORY NOTIFICATION:
- GDPR: Supervisory authority must be notified within 72 hours of becoming aware of a breach likely to result in risk to individuals.
- CCPA: Affected individuals (500+ Californians) must be notified in the most expedient time possible.
- DFARS/CUI: DoD contractors must notify US-CERT and relevant contracting officers within 72 hours.

5.2 CUSTOMER NOTIFICATION:
Clients whose data was involved must be notified without undue delay after the breach is confirmed. All customer notifications must be reviewed by Legal before sending.

5.3 LAW ENFORCEMENT:
Notify law enforcement if the breach involved criminal activity (hacking, theft, fraud).

PHASE 6 - POST-INCIDENT REVIEW
5.4 A post-incident review must be conducted within 5 business days of incident resolution for Priority 1 and 2 incidents.
5.5 The review must document: timeline, root cause, what went well, what could be improved, and specific remediation actions with owners and deadlines.
5.6 Review results must be presented to executive leadership.

6. EVIDENCE RETENTION
All evidence related to a security incident must be preserved for a minimum of 5 years.

7. ROLES AND RESPONSIBILITIES
- Security Team (Incident Commander): Lead technical response; activate the response plan; coordinate containment.
- Legal: Assess notification obligations; draft client and regulatory notifications.
- CISO: Authorize containment and notification decisions; report to executive leadership.

Policy Owner: [CISO / Legal]
Effective Date: [DATE]
Next Review: [DATE - semi-annual given regulatory sensitivity]`,
  },
  {
    key: "secure-communications",
    title: "Secure Communications Policy",
    category: "security",
    description: "Requirements for encrypted data transmission, approved communication channels, prohibited practices, and key management. Satisfies CMMC SC.3.177, FedRAMP SC-8, SOC 2 CC6.7.",
    content: `SECURE COMMUNICATIONS POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for securing data in transit to protect [Organization Name] and client data from interception, eavesdropping, and man-in-the-middle attacks. This policy satisfies CMMC SC.3.177/SC.3.187, FedRAMP SC-8/SC-8(1), and SOC 2 CC6.7.

2. SCOPE
This policy applies to all communications involving [Organization Name] data, including: API traffic, web application traffic, email, file transfers, messaging, video conferencing, and any other transmission of organizational data.

3. ENCRYPTION IN TRANSIT
3.1 All organizational data in transit must be encrypted using Transport Layer Security (TLS) version 1.2 or higher. TLS 1.3 is preferred where supported.
3.2 The following are prohibited:
- SSL v2, SSL v3, TLS 1.0, TLS 1.1 (all deprecated and insecure)
- Unencrypted HTTP for any data access (redirect to HTTPS; HSTS must be enabled)
- Unencrypted FTP; use SFTP or FTPS instead
- Unencrypted Telnet; use SSH (minimum SSHv2) instead
- Unencrypted LDAP; use LDAPS or LDAP with STARTTLS
3.3 TLS certificates must be from a trusted Certificate Authority (CA). Self-signed certificates are not permitted for production systems accessed by clients or the public.
3.4 SSL Labs or equivalent TLS scanning must be performed quarterly on all internet-facing endpoints; minimum grade A is required.

4. CIPHER SUITE REQUIREMENTS
4.1 Only strong cipher suites must be configured:
- Key exchange: ECDHE or DHE (forward secrecy required)
- Symmetric encryption: AES-128-GCM or AES-256-GCM minimum
- Hash: SHA-256 or stronger; MD5 and SHA-1 are prohibited
- Certificate key: RSA-2048 minimum (RSA-4096 or ECDSA-256 preferred)
4.2 NULL cipher suites, export-grade cipher suites, and RC4 are prohibited.

5. APPROVED COMMUNICATION CHANNELS
5.1 The following are approved channels for transmitting Confidential or Restricted data:
- Encrypted email via corporate email system with TLS enforced
- Secure file sharing via approved platform (e.g., SharePoint/OneDrive, Google Drive Enterprise, or platform Evidence Vault)
5.2 The following must NOT be used to transmit Confidential or Restricted data:
- Personal email accounts (Gmail, Hotmail, Yahoo)
- Unapproved file sharing services (consumer Dropbox, WeTransfer free tier)
- SMS/text message (no end-to-end encryption guarantee)
- Social media direct messages

6. EMAIL SECURITY
6.1 Corporate email must have SPF, DKIM, and DMARC configured and enforced (DMARC policy of quarantine or reject).
6.2 Email content containing Restricted/CUI data must use message-level encryption (S/MIME or PGP) when sent to external recipients; TLS transport encryption alone is not sufficient for this data classification.
6.3 Inbound email must be filtered for malware and phishing via an email security gateway.

7. VIDEO CONFERENCING
7.1 Video conferencing for meetings discussing Confidential or Restricted information must use platforms that provide encryption in transit.
7.2 Meeting links must not be shared publicly; waiting rooms and meeting passwords must be used.

8. API AND SERVICE-TO-SERVICE COMMUNICATION
8.1 All service-to-service API communication must use TLS.
8.2 Internal service mesh communication must be encrypted (mTLS preferred).
8.3 Certificates used for service-to-service communication must be rotated at minimum annually.

9. ROLES AND RESPONSIBILITIES
- IT/Engineering: Configure TLS on all systems; manage certificates; implement email security controls.
- Security Team: Monitor TLS configurations; conduct quarterly SSL scans; maintain approved tools list.
- All Employees: Use only approved communication channels for Confidential/Restricted data.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "risk-assessment",
    title: "Risk Assessment Policy",
    category: "compliance",
    description: "Framework for identifying, scoring, and treating organizational risk including assessment frequency, risk register management, and risk acceptance criteria. Satisfies CMMC CA.2.157, FedRAMP RA-3, SOC 2 CC9.1.",
    content: `RISK ASSESSMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s approach to identifying, assessing, and treating information security risks. Systematic risk management ensures that security resources are directed at the most significant threats and that residual risks are explicitly accepted by appropriate authority. This policy satisfies CMMC CA.2.157, FedRAMP RA-3/PM-9, and SOC 2 CC9.1.

2. SCOPE
This policy applies to all information security risks affecting [Organization Name]'s systems, data, operations, and the clients it serves.

3. RISK ASSESSMENT CADENCE
3.1 A formal risk assessment must be conducted at minimum annually.
3.2 Out-of-cycle risk assessments must be triggered by:
- Significant changes to the threat landscape
- Significant organizational changes (new product launch, merger/acquisition, major new client)
- Significant system changes (new platform architecture, major new integration, cloud migration)
- Following a significant security incident

4. RISK ASSESSMENT METHODOLOGY
4.1 [Organization Name] uses a qualitative/semi-quantitative risk scoring approach:
- Likelihood: The probability that a threat will successfully exploit a vulnerability (1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain)
- Impact: The consequence to the organization if the risk materializes (1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic)
- Risk Score: Likelihood x Impact (1-25 scale)

Risk thresholds:
- Critical (20-25): Immediate escalation to CISO and executive leadership; treatment plan required within 15 days
- High (12-19): CISO awareness required; treatment plan required within 30 days
- Medium (6-11): Security team ownership; treatment plan required within 90 days
- Low (1-5): Accepted unless treatment is low-cost; review annually

5. RISK REGISTER
5.1 All identified risks must be documented in the organization's risk register with:
- Unique risk ID, risk description, threat source and vulnerability exploited
- Affected assets and systems
- Likelihood score, Impact score, Risk score (L x I)
- Risk owner (named individual)
- Current treatment status (open/in remediation/mitigated/accepted)
- Planned treatment and target completion date
- Date identified and date last reviewed
5.2 The risk register must be reviewed monthly by the Security team.
5.3 Critical and High risks must be reviewed in every monthly security meeting.

6. RISK TREATMENT OPTIONS
For each identified risk, the risk owner must select and document a treatment approach:
- Mitigate: Implement controls to reduce the likelihood or impact to an acceptable level.
- Accept: Accept the risk without further action. All acceptances must be documented and signed by the CISO.
- Transfer: Shift the financial impact to a third party (e.g., cyber insurance).
- Avoid: Eliminate the risk by ceasing the activity that creates it.

7. RISK ACCEPTANCE CRITERIA
7.1 Risk acceptance requires written documentation including: risk description, risk score, business justification, compensating controls, and a re-evaluation date.
7.2 Acceptance authority by risk level:
- Low (1-5): Risk owner may accept
- Medium (6-11): Manager approval required
- High (12-19): CISO approval required
- Critical (20-25): CISO + Executive leadership (CEO/CTO) approval required; Board notification if persistent
7.3 Risk acceptances must be re-evaluated at least annually.

8. RISK REPORTING
A risk summary must be presented to executive leadership quarterly, including: total open risks by severity, trend (improving/stable/declining), top 5 risks by score, and overdue treatment plans.

9. ROLES AND RESPONSIBILITIES
- CISO: Own the risk management program; lead annual assessments; approve High/Critical acceptances.
- Risk Owners: Actively manage assigned risks; implement treatment plans; provide status updates.
- Security Team: Maintain the risk register; conduct assessments; monitor for new risks.
- Executive Leadership: Allocate resources for risk treatment; accept Critical risks.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "cmmc-compliance",
    title: "CMMC Compliance Policy",
    category: "federal",
    description: "Policy establishing [Organization Name]'s commitment to CMMC Level 2 compliance, CUI handling requirements, subcontractor obligations, and assessment schedule. Satisfies DFARS 252.204-7012 and NIST SP 800-171.",
    content: `CMMC COMPLIANCE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s commitment to achieving and maintaining Cybersecurity Maturity Model Certification (CMMC) Level 2 compliance and governing the handling of Controlled Unclassified Information (CUI) and Federal Contract Information (FCI). Compliance with CMMC is required for participation in Department of Defense (DoD) contracts and is enforced through DFARS 252.204-7012 and 252.204-7021.

2. SCOPE
This policy applies to all [Organization Name] systems, personnel, and subcontractors that handle, process, store, or transmit FCI or CUI in the performance of DoD contracts.

3. CMMC LEVEL AND FRAMEWORK
3.1 [Organization Name] targets CMMC Level 2 compliance, which requires implementation of all 110 security requirements in NIST SP 800-171 Rev 2.
3.2 The 110 NIST SP 800-171 requirements are organized in 14 domains. [Organization Name] maintains a System Security Plan (SSP) documenting implementation status for each requirement.
3.3 The SPRS (Supplier Performance Risk System) score derived from the NIST SP 800-171 self-assessment must be submitted to the DoD Assessment Methodology portal prior to award of applicable contracts.

4. CUI HANDLING REQUIREMENTS
4.1 CUI must be identified and labeled per the CUI Registry (cui.gov) and applicable contract requirements.
4.2 CUI must be protected with controls meeting or exceeding NIST SP 800-171:
- Access restricted to personnel with a need to know
- Encrypted in transit (TLS 1.2+) and at rest (AES-256 or equivalent)
- Stored only on systems within the defined authorization boundary
- Transmitted only through approved, encrypted channels
- Not stored on personal devices unless those devices are MDM-enrolled and encrypted
4.3 CUI must not be processed or stored in non-US cloud environments. All cloud services used for CUI must be FedRAMP authorized.
4.4 Unauthorized disclosure of CUI must be reported to the CISO immediately and to the relevant contracting officer within the required reporting window.

5. AUTHORIZATION BOUNDARY
5.1 [Organization Name] maintains a defined authorization boundary that includes all systems that handle FCI or CUI.
5.2 The boundary must be documented in the System Security Plan and updated within 30 days of significant system changes.
5.3 Cloud service providers used within the boundary must be FedRAMP authorized.

6. SUBCONTRACTOR REQUIREMENTS
6.1 Any subcontractor or supplier who will handle FCI or CUI must be required by contract to: implement NIST SP 800-171, pursue appropriate CMMC certification, submit a SPRS score, report incidents within 72 hours, and flow down these requirements to their own subcontractors.
6.2 [Organization Name] must verify subcontractor CMMC/SPRS compliance status before and periodically during the subcontract period.
6.3 Contracts with subcontractors handling CUI must include the DFARS 252.204-7012 clause.

7. INCIDENT REPORTING OBLIGATIONS
7.1 Any cybersecurity incident that affects covered systems or CUI must be reported to US-CERT (report.cisa.gov) within 72 hours per DFARS 252.204-7012.
7.2 The relevant contracting officer must also be notified within 72 hours.
7.3 [Organization Name] must preserve images of all affected systems for 90 days to support DoD forensic investigation.

8. ASSESSMENT AND CERTIFICATION
8.1 [Organization Name] must conduct an annual self-assessment of NIST SP 800-171 compliance using the DoD Assessment Methodology. Results must be documented and submitted to SPRS.
8.2 For contracts requiring CMMC Level 2 certification: [Organization Name] must engage a C3PAO (CMMC Third-Party Assessment Organization) for a formal triennial assessment.
8.3 All deficiencies identified in assessments must be tracked in the Plan of Action and Milestones (POA&M) with target remediation dates.

9. CONTINUOUS COMPLIANCE
9.1 NIST SP 800-171 compliance must be maintained continuously, not only at assessment time.
9.2 Monthly control effectiveness reviews must be conducted by the Security team.

10. ROLES AND RESPONSIBILITIES
- CISO: Own CMMC compliance; maintain SSP; submit SPRS scores; coordinate C3PAO assessments.
- Security Team: Implement and monitor controls; maintain POA&M; conduct monthly reviews.
- Contracts/Legal: Include required DFARS clauses in subcontracts; verify subcontractor compliance.
- All Personnel Handling CUI: Complete CUI-specific training; follow CUI handling procedures; report incidents.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "fedramp-compliance",
    title: "FedRAMP Compliance Policy",
    category: "federal",
    description: "Policy establishing [Organization Name]'s commitment to FedRAMP Moderate authorization, including SSP maintenance, ConMon obligations, and the authorization boundary.",
    content: `FEDRAMP COMPLIANCE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s commitment to achieving and maintaining FedRAMP (Federal Risk and Authorization Management Program) Moderate authorization for the EnterpriseComply cloud service offering. FedRAMP authorization is required for federal agencies to procure cloud services and demonstrates compliance with NIST SP 800-53 Rev 5 security controls at the Moderate impact level.

2. SCOPE
This policy applies to the EnterpriseComply cloud service offering and all systems, personnel, and subprocessors within its FedRAMP authorization boundary.

3. FEDRAMP TARGET AND TIMELINE
3.1 [Organization Name] targets FedRAMP Moderate authorization.
3.2 The CISO maintains a FedRAMP readiness roadmap with milestones for: SSP completion, 3PAO readiness assessment, authorization package submission, and Authority to Operate (ATO) issuance.

4. SYSTEM SECURITY PLAN (SSP)
4.1 [Organization Name] must develop and maintain a System Security Plan (SSP) documenting implementation of all applicable NIST SP 800-53 Rev 5 Moderate baseline controls.
4.2 The SSP must document: system description and purpose, authorization boundary and data flows, system categorization (FIPS 199), control implementation status, and leveraged authorizations (inherited controls from FedRAMP-authorized cloud providers).
4.3 The SSP must be updated within 30 days of significant changes to the system or control implementations.

5. AUTHORIZATION BOUNDARY
5.1 The FedRAMP authorization boundary must be explicitly defined and documented in the SSP.
5.2 All cloud services, infrastructure components, and third-party services within the boundary must comply with applicable FedRAMP requirements.
5.3 Cloud infrastructure (IaaS/PaaS) providers used within the boundary must be FedRAMP authorized; their inherited controls must be documented in the SSP.

6. FEDRAMP AUTHORIZATION PROCESS
6.1 The authorization package must include: SSP, Privacy Impact Assessment (PIA), Security Assessment Plan (SAP), Security Assessment Report (SAR), and Plan of Action and Milestones (POA&M).
6.2 Security assessment must be conducted by a FedRAMP-recognized Third-Party Assessment Organization (3PAO).
6.3 Authorization may be pursued via: Agency ATO (agreement with a federal sponsor agency) or JAB Provisional ATO (Joint Authorization Board review for broader reuse).

7. CONTINUOUS MONITORING (CONMON)
7.1 Once authorized, [Organization Name] must maintain continuous monitoring activities per FedRAMP ConMon requirements:
- Ongoing: Automated vulnerability scanning, configuration monitoring, incident monitoring
- Monthly: Submit vulnerability scan results to the authorizing agency; update POA&M
- Annually: Update SSP; conduct annual security assessment; submit Annual Assessment package
- Significant change: Conduct significant change assessment and notify authorizing agency before implementing
7.2 ConMon deliverables must be submitted to the authorizing agency and FedRAMP PMO on required schedules. Late submissions may result in suspension of the ATO.

8. INCIDENT REPORTING TO FEDRAMP
8.1 Security incidents affecting federal agency data or the authorization boundary must be reported to US-CERT (report.cisa.gov) within 1 hour of discovery.
8.2 Affected federal agencies must be notified within 1 hour of US-CERT reporting.
8.3 The FedRAMP PMO must be notified within 24 hours of a confirmed significant incident.

9. FEDRAMP DATA REQUIREMENTS
9.1 Federal agency data must be stored only in FedRAMP-authorized environments within the United States.
9.2 Data encryption must meet FedRAMP requirements: FIPS 140-2/3 validated encryption modules for all encryption protecting federal data.

10. ROLES AND RESPONSIBILITIES
- CISO: Own the FedRAMP authorization; maintain the SSP; oversee ConMon; report to authorizing agency.
- Security Team: Conduct ConMon activities; prepare ConMon deliverables; manage the POA&M.
- Engineering: Implement NIST SP 800-53 controls; maintain FedRAMP-compliant infrastructure.
- Legal/Contracts: Manage agency agreements; ensure contractual compliance with federal requirements.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]`,
  },
  {
    key: "dpa-template",
    title: "Data Processing Agreement (DPA) Template",
    category: "legal",
    description: "Template DPA for use with clients and subprocessors where ColorCode Solutions acts as a data processor handling personal data. Required before onboarding clients under GDPR Article 28 and SOC 2 C1.2.",
    content: `DATA PROCESSING AGREEMENT (DPA)
Template Version: 1.0 | Classification: Confidential
NOTE: This template must be reviewed by Legal before use. Fill in all bracketed placeholders.

This Data Processing Agreement ("DPA") is entered into between:

DATA CONTROLLER: [CLIENT ORGANIZATION NAME], a [state/country] [corporation/LLC/etc.], ("Controller")
DATA PROCESSOR: ColorCode Solutions, LLC, ("Processor"), providing the EnterpriseComply platform

This DPA supplements and is incorporated into the Master Service Agreement or Terms of Service between the parties ("Main Agreement"). In the event of conflict between this DPA and the Main Agreement, this DPA governs with respect to data processing matters.

ARTICLE 1 - DEFINITIONS
"Personal Data" means any information relating to an identified or identifiable natural person.
"Processing" means any operation performed on Personal Data.
"Data Subject" means the individual to whom Personal Data relates.
"Sub-processor" means any processor engaged by Processor to process Personal Data on behalf of Controller.
"Applicable Data Protection Law" means all applicable laws relating to data protection and privacy, including GDPR, CCPA, and applicable state privacy laws.

ARTICLE 2 - SCOPE AND PURPOSES OF PROCESSING
2.1 Processor shall process Personal Data solely on behalf of Controller and in accordance with Controller's documented instructions.
2.2 Processing purposes: Provision of the EnterpriseComply compliance management platform as described in the Main Agreement.
2.3 Categories of data subjects: Controller's employees, contractors, clients, and other individuals whose data Controller uploads to the platform.
2.4 Categories of personal data: As uploaded by Controller, may include: names, email addresses, job titles, authentication credentials, compliance-related documents, and other business records.
2.5 Duration of processing: For the term of the Main Agreement and thereafter only as necessary for legal obligations or as directed by Controller.

ARTICLE 3 - PROCESSOR OBLIGATIONS
3.1 Processor shall process Personal Data only on documented instructions from Controller, unless required to do so by applicable law.
3.2 Processor shall ensure that persons authorized to process Personal Data are subject to confidentiality obligations.
3.3 Processor shall implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including: encryption of Personal Data at rest (AES-256) and in transit (TLS 1.2+), ability to ensure ongoing confidentiality, integrity, availability, and resilience of processing systems, ability to restore availability and access to Personal Data in a timely manner in the event of an incident, and a process for regularly testing and evaluating the effectiveness of security measures.
3.4 Processor shall not engage sub-processors without prior written authorization from Controller. See Schedule A for current sub-processor list.
3.5 Processor shall notify Controller without undue delay (and in any event within 72 hours) upon becoming aware of a Personal Data breach involving Controller's data.
3.6 Processor shall assist Controller in fulfilling data subject rights requests (access, rectification, erasure, portability, objection) within 5 business days of receiving notice from Controller.
3.7 Upon termination of the Main Agreement, Processor shall, at Controller's election, return or securely delete all Personal Data within 30 days.

ARTICLE 4 - CONTROLLER OBLIGATIONS
4.1 Controller represents that it has the legal right and authority to provide Personal Data to Processor.
4.2 Controller shall ensure that data subjects have been informed of the processing by Processor as required by applicable law.
4.3 Controller is responsible for determining the lawful basis for processing Personal Data under applicable law.

ARTICLE 5 - INTERNATIONAL TRANSFERS
5.1 Personal Data of EU/UK data subjects shall not be transferred outside the EEA/UK without: an adequacy decision, Standard Contractual Clauses (SCCs), or another approved transfer mechanism.
5.2 All Personal Data shall be stored and processed within the United States unless otherwise agreed in writing.

ARTICLE 6 - SUB-PROCESSORS
6.1 Controller provides general written authorization for Processor to engage sub-processors for the provision of the service.
6.2 Processor shall notify Controller at least 30 days in advance of adding or replacing sub-processors. Controller may object within this notice period on reasonable data protection grounds.
6.3 See Schedule A for the current list of authorized sub-processors.

ARTICLE 7 - AUDIT RIGHTS
7.1 Processor shall, upon reasonable notice (minimum 30 days), allow Controller or Controller's auditor to audit compliance with this DPA, no more than once per year unless a data breach has occurred.
7.2 Processor may, in lieu of granting direct audit access, provide Controller with an up-to-date SOC 2 Type II report or ISO 27001 certificate.

SCHEDULE A - AUTHORIZED SUB-PROCESSORS
[Current sub-processor list maintained at: [URL or incorporated by reference to Processor's publicly available sub-processor list]]

SCHEDULE B - SECURITY MEASURES
Technical and organizational measures implemented by Processor:
- Encryption: AES-256 at rest; TLS 1.2+ in transit; FIPS 140-2 validated modules
- Access Control: Role-based access control; MFA required for all platform access; least-privilege provisioning
- Logging: Comprehensive audit logging retained for 3 years; tamper-evident log storage
- Vulnerability Management: Monthly vulnerability scanning; Critical patches within 15 days
- Penetration Testing: Annual third-party penetration testing
- Business Continuity: Daily encrypted backups; cross-region replication for Tier 1 data; 4-hour RTO
- Employee Training: Annual security awareness training for all staff; role-based secure development training
- Incident Response: Documented incident response plan; 72-hour breach notification SLA

Signed by authorized representatives of each party on the dates indicated below.

CONTROLLER: _________________________ Date: ___________
Name: _________________ Title: _________________

PROCESSOR (ColorCode Solutions): _________________________ Date: ___________
Name: _________________ Title: _________________`,
  },
  {
    key: "terms-of-service",
    title: "Terms of Service Template",
    category: "legal",
    description: "Template Terms of Service for the EnterpriseComply platform, covering acceptable use, service commitments, data ownership, liability limitations, and termination. Review by Legal required before publication.",
    content: `TERMS OF SERVICE - EnterpriseComply
Template Version: 1.0 | Classification: Confidential (pending Legal review)
NOTE: This template must be reviewed and approved by Legal before publication. All bracketed placeholders must be completed.

Effective Date: [DATE]

These Terms of Service ("Terms") govern your use of the EnterpriseComply compliance management platform ("Service") provided by ColorCode Solutions, LLC ("ColorCode Solutions", "we", "us", "our"). By accessing or using the Service, you agree to these Terms on behalf of yourself and the organization you represent ("Customer", "you").

1. SERVICE DESCRIPTION
1.1 EnterpriseComply is a cloud-based Governance, Risk, and Compliance (GRC) platform that assists organizations in managing compliance with security frameworks including CMMC, FedRAMP, SOC 2, ISO 27001, and others.
1.2 The Service is provided "as a service" - Customer accesses the Service via a web browser; ColorCode Solutions hosts and maintains the infrastructure.

2. ACCOUNTS AND ACCESS
2.1 Customer is responsible for maintaining the confidentiality of all account credentials and for all activity that occurs under Customer's account.
2.2 Customer must immediately notify ColorCode Solutions of any unauthorized use of an account.
2.3 Each person must have their own account; accounts may not be shared.
2.4 ColorCode Solutions may suspend accounts that show evidence of unauthorized use or that violate these Terms.

3. ACCEPTABLE USE
3.1 Customer agrees to use the Service only for lawful purposes and in accordance with these Terms.
3.2 Customer shall not: use the Service to violate any applicable law or regulation; upload malicious code or viruses; attempt to gain unauthorized access to the Service or its underlying systems; reverse engineer, decompile, or disassemble the Service; use automated tools to scrape or harvest data without authorization; resell, sublicense, or white-label the Service without express written agreement; or use the Service for competitive benchmarking without written approval.

4. CUSTOMER DATA
4.1 Customer retains full ownership of all data uploaded to or generated within the Service ("Customer Data").
4.2 ColorCode Solutions processes Customer Data solely to provide the Service and will not sell, share, or use Customer Data for any other purpose without Customer's consent, except as required by law.
4.3 Upon termination, ColorCode Solutions will provide Customer Data in a standard exportable format upon request for 30 days following termination; after this period, Customer Data will be securely deleted.

5. SERVICE LEVELS AND AVAILABILITY
5.1 ColorCode Solutions targets [99.5]% monthly uptime for the Service (excluding scheduled maintenance).
5.2 Scheduled maintenance will be performed during off-peak hours with a minimum of [48 hours] advance notice.
5.3 Service Credits for downtime below the SLA target are Customer's sole remedy for downtime.

6. FEES AND PAYMENT
6.1 Fees are as agreed in the Order Form or subscription agreement.
6.2 Fees are due [30 days] from invoice date. Late payments are subject to a [1.5]% monthly late fee.
6.3 ColorCode Solutions may suspend the Service upon [15 days] notice for non-payment.
6.4 All fees are non-refundable except as required by applicable law.

7. INTELLECTUAL PROPERTY
7.1 ColorCode Solutions retains all ownership of the Service, including all software, designs, algorithms, and technology underlying the Service.
7.2 Customer retains all ownership of Customer Data.
7.3 ColorCode Solutions may use aggregated, anonymized, non-identifiable usage data to improve the Service.

8. CONFIDENTIALITY
Both parties agree to keep confidential all non-public information received from the other party in connection with these Terms and to use such information only for the purposes of the Agreement.

9. DATA PROTECTION
9.1 ColorCode Solutions processes Customer Data in accordance with the Data Processing Agreement (DPA) executed by the parties and the Privacy Policy published at [URL].
9.2 ColorCode Solutions maintains security standards as described in the DPA Schedule B.

10. DISCLAIMERS
10.1 THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, COLORCODE SOLUTIONS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
10.2 COLORCODE SOLUTIONS DOES NOT WARRANT THAT USE OF THE SERVICE WILL RESULT IN COMPLIANCE WITH ANY REGULATORY FRAMEWORK OR THAT ASSESSMENTS WILL RESULT IN CERTIFICATION OR AUTHORIZATION. THE SERVICE IS A TOOL TO ASSIST CUSTOMER'S COMPLIANCE EFFORTS; IT DOES NOT GUARANTEE COMPLIANCE OUTCOMES.

11. LIMITATION OF LIABILITY
11.1 TO THE MAXIMUM EXTENT PERMITTED BY LAW, COLORCODE SOLUTIONS' TOTAL LIABILITY TO CUSTOMER FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE FEES PAID BY CUSTOMER IN THE [12] MONTHS PRECEDING THE CLAIM.
11.2 NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, EVEN IF ADVISED OF THEIR POSSIBILITY.

12. TERM AND TERMINATION
12.1 These Terms begin on the date Customer first uses the Service and continue until terminated.
12.2 Either party may terminate these Terms with [30 days] written notice.
12.3 Either party may terminate immediately if the other party: materially breaches these Terms and fails to cure within [15 days] of written notice; or becomes insolvent or files for bankruptcy.
12.4 Upon termination, Customer's access to the Service will cease, and the data return/deletion obligations of Section 4 apply.

13. GOVERNING LAW AND DISPUTES
13.1 These Terms are governed by the laws of the State of [Delaware], without regard to conflict of law principles.
13.2 Disputes shall be resolved by binding arbitration under [AAA Commercial Arbitration Rules], except that either party may seek injunctive relief in court for IP infringement or breach of confidentiality.

14. GENERAL PROVISIONS
14.1 Entire Agreement: These Terms, the DPA, and any executed Order Form constitute the entire agreement between the parties.
14.2 Amendments: ColorCode Solutions may update these Terms with 30 days notice. Continued use after the effective date constitutes acceptance.
14.3 Assignment: Customer may not assign these Terms without ColorCode Solutions' written consent.

15. CONTACT
Questions about these Terms: legal@colorcodesolutions.com
Security concerns: security@colorcodesolutions.com
General inquiries: info@colorcodesolutions.com

ColorCode Solutions, LLC
[Address]
[City, State, ZIP]`,
  },
];

function buildTsPolicy(policy) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `  {
    key: "${policy.key}",
    title: "${policy.title.replace(/"/g, '\\"')}",
    category: "${policy.category}",
    description: "${policy.description.replace(/"/g, '\\"')}",
    content: \`${esc(policy.content)}\`,
  }`;
}

const filepath = "artifacts/api-server/src/modules/policies/policies.service.ts";
let content = fs.readFileSync(filepath, "utf8");

// Find where stubs begin
const stubMarker = '  { key: "remote-work"';
const stubStart = content.indexOf(stubMarker);
if (stubStart === -1) {
  console.error("ERROR: Could not find stub section start (remote-work)");
  process.exit(1);
}

// Find the closing ]; of POLICY_TEMPLATES
const arrayEnd = content.indexOf("\n];", stubStart);
if (arrayEnd === -1) {
  console.error("ERROR: Could not find array closing ];");
  process.exit(1);
}

// Build new content for the stubs section
const newStubs = ",\n" + POLICIES.map(buildTsPolicy).join(",\n") + "\n";

// Splice in new content
const newFile = content.slice(0, stubStart) + newStubs + content.slice(arrayEnd);

fs.writeFileSync(filepath, newFile, "utf8");

console.log(`Done! Replaced stubs with ${POLICIES.length} full policies.`);
console.log(`New file length: ${newFile.split("\n").length} lines`);
