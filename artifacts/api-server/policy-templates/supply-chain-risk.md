SUPPLY CHAIN RISK MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for identifying, assessing, and managing cybersecurity risks introduced through [Organization Name]'s supply chain. This policy addresses CMMC SR.1.016/SR.2.004, NIST SP 800-161, and FedRAMP SA-12.

2. SCOPE
This policy applies to all third-party software (commercial, open source, SaaS), hardware, and services that are integrated into or support [Organization Name]'s production systems.

3. SUPPLIER INVENTORY
3.1 [Organization Name] must maintain a current inventory of all suppliers providing software, hardware, managed security services, IT services, or cloud platforms critical to production operations.
3.2 Suppliers must be classified by criticality tier:
- Critical: Suppliers whose failure or compromise could directly affect the security or availability of the production platform or client data
- Important: Suppliers whose disruption would significantly impact operations
- Standard: Suppliers with limited impact if disrupted
3.3 The supplier inventory must be reviewed and updated at minimum annually.

4. PRE-PROCUREMENT SECURITY ASSESSMENT
4.1 Before procuring a new Critical or Important supplier, a security assessment must be completed.
4.2 The assessment must review: the supplier's SOC 2 Type II report (or equivalent), their data handling and privacy practices, their incident notification obligations, and their business continuity capabilities.
4.3 For suppliers processing Restricted or CUI data, additional requirements apply: FedRAMP authorization or equivalent, ability to execute a DPA, and no ownership or operations in countries designated as high-risk.

5. CONTRACTUAL SECURITY REQUIREMENTS
All contracts with Critical and Important suppliers must include:
- Security and data protection obligations equivalent to [Organization Name]'s own standards
- Right to audit provisions
- Incident notification requirements (supplier must notify within 72 hours of a security incident affecting us)
- Right to terminate for cause if supplier fails to meet security obligations

6. SOFTWARE BILL OF MATERIALS (SBOM)
6.1 [Organization Name] must maintain a Software Bill of Materials (SBOM) for all production software, including commercial, open source, and transitive dependencies.
6.2 The SBOM must be reviewed against known vulnerability databases at minimum monthly.
6.3 Open source components must be assessed for: known CVEs, license compatibility, maintenance status, and supply chain risks.

7. PROHIBITED SUPPLIERS
7.1 [Organization Name] maintains a prohibited supplier list based on U.S. government sanctions lists and National Security threat designations.
7.2 Software, hardware, or services from prohibited suppliers must not be used in production environments without explicit CISO and legal approval.

8. ONGOING MONITORING
8.1 Critical suppliers must be reviewed annually (updated SOC 2 report, news monitoring, threat intelligence).
8.2 Security incidents at Critical suppliers must trigger an immediate review of potential impact.

9. ROLES AND RESPONSIBILITIES
- Procurement/Legal: Ensure security requirements are in supplier contracts; maintain supplier inventory.
- Security Team: Define security requirements; conduct security assessments; maintain prohibited supplier list.
- Engineering: Maintain SBOM; monitor dependencies for vulnerabilities.

Policy Owner: [CISO / Procurement Manager]
Effective Date: [DATE]
Next Review: [DATE]