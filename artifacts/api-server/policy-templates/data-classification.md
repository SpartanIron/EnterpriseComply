DATA CLASSIFICATION POLICY
Version: 1.0 | Review Cycle: Annual

1. PURPOSE
This policy establishes a classification framework for [Organization Name]'s data assets. Proper classification ensures that appropriate security controls are applied to protect data based on its sensitivity, regulatory requirements, and business value.

2. SCOPE
This policy applies to all data created, processed, stored, or transmitted by [Organization Name], including data in digital and physical form, regardless of location (on-premises, cloud, third-party systems, or employee devices).

3. CLASSIFICATION TIERS

3.1 PUBLIC
Definition: Information approved for public release with no adverse impact if disclosed.
Examples: Marketing materials, published press releases, public website content, open-source documentation.
Handling: No special controls required. May be freely shared externally.

3.2 INTERNAL
Definition: Information intended for internal use only. Disclosure could cause minor inconvenience or operational impact.
Examples: Internal policies, general business communications, meeting notes, internal directories.
Handling: Must not be shared with unauthorized external parties. Transmit over encrypted channels. Dispose of securely when no longer needed.

3.3 CONFIDENTIAL
Definition: Sensitive business information where unauthorized disclosure could cause material harm to the organization, customers, or partners.
Examples: Financial projections, contracts, customer lists, product roadmaps, HR records, business strategies.
Handling: Access restricted to need-to-know personnel. Encrypt at rest and in transit. Label documents appropriately. Do not transmit via personal email or unapproved services. Formal data sharing agreements required for third-party access.

3.4 RESTRICTED
Definition: Highly sensitive data subject to regulatory requirements or where disclosure could cause severe harm including legal liability, regulatory fines, or breach of contract.
Examples: Personally Identifiable Information (PII), Protected Health Information (PHI), Payment Card Data (PCI), authentication credentials, encryption keys, government Controlled Unclassified Information (CUI).
Handling: Strongest available encryption required. Access limited to specifically authorized individuals. MFA required for all access. Comprehensive audit logging required. Data must not leave approved environments without explicit authorization. Governed by applicable regulations (HIPAA, PCI DSS, GDPR, CMMC, etc.).

4. DATA LABELING
4.1 All documents and files containing Confidential or Restricted data must be labeled with the appropriate classification marking in the header or footer.
4.2 Electronic labels must be applied using approved DLP tooling where available.
4.3 Physical documents must be stamped or marked with the classification tier.

5. DATA HANDLING REQUIREMENTS BY TIER
| Requirement          | Public | Internal | Confidential | Restricted |
|---------------------|--------|----------|--------------|------------|
| Encrypt in transit  | No     | Yes      | Yes          | Yes (TLS 1.2+) |
| Encrypt at rest     | No     | No       | Yes          | Yes (AES-256) |
| MFA for access      | No     | No       | Recommended  | Required   |
| Audit logging       | No     | No       | Recommended  | Required   |
| DLP controls        | No     | No       | Yes          | Yes        |
| Secure disposal     | No     | Yes      | Yes          | Yes (certified) |

6. DATA DISPOSAL
Data must be disposed of securely at end of retention period per the Data Retention and Disposal Policy. Restricted data must be destroyed using NIST 800-88 compliant methods.

7. ROLES AND RESPONSIBILITIES
- Data Owners: Business leaders responsible for classifying data in their domain and authorizing access.
- Data Custodians: IT personnel responsible for implementing technical controls.
- All Employees: Correctly handle and label data in accordance with this policy.
- Legal/Compliance: Maintain awareness of regulatory requirements that affect classification.

8. REVIEW
This policy will be reviewed annually and whenever new categories of regulated data are introduced or regulatory requirements change.