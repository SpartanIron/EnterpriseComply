CLOUD SECURITY POLICY
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
Next Review: [DATE]