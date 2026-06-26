ENCRYPTION POLICY
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
This policy will be reviewed annually or following significant changes to cryptographic standards, regulatory requirements, or upon any confirmed cryptographic weakness or key compromise.