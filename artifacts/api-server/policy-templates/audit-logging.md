AUDIT LOGGING POLICY
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
This policy will be reviewed annually or following a security incident where log availability or integrity was a factor.