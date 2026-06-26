PASSWORD AND AUTHENTICATION POLICY
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
This policy will be reviewed annually or following any significant authentication-related security incident.