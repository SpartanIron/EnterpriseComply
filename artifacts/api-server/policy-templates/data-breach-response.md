DATA BREACH RESPONSE POLICY
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
Next Review: [DATE - semi-annual given regulatory sensitivity]