PRIVILEGED ACCESS MANAGEMENT POLICY
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
Next Review: [DATE]