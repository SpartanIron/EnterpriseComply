IDENTITY & ACCESS MANAGEMENT POLICY
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
Next Review: [DATE]