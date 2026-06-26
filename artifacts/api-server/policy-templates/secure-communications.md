SECURE COMMUNICATIONS POLICY
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
Next Review: [DATE]