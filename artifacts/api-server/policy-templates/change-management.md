CHANGE MANAGEMENT POLICY
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
This policy will be reviewed annually or following a significant change-related incident.