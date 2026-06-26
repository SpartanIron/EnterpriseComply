MULTI-FACTOR AUTHENTICATION (MFA) POLICY
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
Next Review: [DATE]