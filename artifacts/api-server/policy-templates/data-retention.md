DATA RETENTION & DISPOSAL POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes retention schedules for organizational data and secure disposal procedures for data that has exceeded its retention period. Proper retention ensures compliance with legal obligations and framework requirements; secure disposal prevents unauthorized access to sensitive data after retention periods expire.

2. SCOPE
This policy applies to all data created, received, stored, or processed by [Organization Name], in all formats (electronic, physical) and in all locations (on-premises, cloud, third-party processors, backups).

3. DATA RETENTION SCHEDULES
3.1 By Data Classification:

RESTRICTED / CUI (Controlled Unclassified Information):
- Audit logs and access records: 3 years (CMMC AU.3.045 / FedRAMP AU-11 minimum)
- Security incident records: 5 years
- CUI itself: Per the CUI handling requirements of the applicable federal contract

CONFIDENTIAL:
- Financial records and contracts: 7 years
- HR records (employment, performance, termination): 7 years
- Customer contracts and data processing records: Duration of relationship + 5 years
- Security assessment reports and pen test results: 3 years
- Evidence Vault artifacts: 3 years after framework observation period

INTERNAL:
- General business records and email: 3 years
- System logs (non-security): 1 year
- Project documentation: 3 years after project closure

PUBLIC:
- Marketing materials and published documents: Duration of relevance

3.2 Legal, regulatory, or contractual requirements that mandate longer retention periods supersede this schedule. The legal team must be consulted before destroying any record subject to potential litigation, regulatory inquiry, or active investigation.

4. LEGAL HOLD
4.1 When litigation, regulatory investigation, or audit is anticipated or initiated, a Legal Hold is issued by Legal/Compliance.
4.2 Legal Holds suspend all retention-based disposal for data within the hold scope.
4.3 System owners and data custodians must acknowledge and comply with Legal Hold notices within 24 hours.
4.4 Legal Holds remain in effect until formally released in writing.

5. DATA DISPOSAL AND DESTRUCTION
5.1 Electronic media must be disposed of per NIST SP 800-88 Guidelines for Media Sanitization:
- Internal use only / Public data: Clear (overwrite using approved software, minimum DoD 5220.22-M 3-pass)
- Confidential / Restricted data: Purge (cryptographic erasure for encrypted media or NIST-compliant overwrite) or Physical Destruction
- Destroyed media must not be reused in production systems

5.2 Physical documents containing Confidential or Restricted information must be shredded using cross-cut or micro-cut shredders. Strip-cut shredding is not acceptable for Restricted data.

5.3 Cloud data deletion must be confirmed via provider tools or API response and documented. Verify that data is removed from all backups, caches, and replicas within the cloud provider's stated deletion timeframe.

5.4 Third-party processors must be required via contract to return or destroy organizational data within 30 days of contract termination and provide written certification.

5.5 Media destruction must be documented: record the date, media type and identifier, destruction method, and the name of the person who performed or witnessed destruction.

6. ROLES AND RESPONSIBILITIES
- Data Owners: Classify data and ensure retention schedules are applied.
- IT/Security: Implement technical controls for retention and disposal.
- Legal/Compliance: Manage legal holds; advise on regulatory obligations.
- All Employees: Follow disposal procedures; not circumvent retention controls.

7. ENFORCEMENT
Unauthorized destruction of data subject to a retention obligation or Legal Hold is a serious violation that may result in disciplinary action and personal legal liability.

Policy Owner: [CISO / Data Protection Officer]
Effective Date: [DATE]
Next Review: [DATE]