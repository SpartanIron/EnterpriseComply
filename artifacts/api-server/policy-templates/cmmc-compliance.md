CMMC COMPLIANCE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s commitment to achieving and maintaining Cybersecurity Maturity Model Certification (CMMC) Level 2 compliance and governing the handling of Controlled Unclassified Information (CUI) and Federal Contract Information (FCI). Compliance with CMMC is required for participation in Department of Defense (DoD) contracts and is enforced through DFARS 252.204-7012 and 252.204-7021.

2. SCOPE
This policy applies to all [Organization Name] systems, personnel, and subcontractors that handle, process, store, or transmit FCI or CUI in the performance of DoD contracts.

3. CMMC LEVEL AND FRAMEWORK
3.1 [Organization Name] targets CMMC Level 2 compliance, which requires implementation of all 110 security requirements in NIST SP 800-171 Rev 2.
3.2 The 110 NIST SP 800-171 requirements are organized in 14 domains. [Organization Name] maintains a System Security Plan (SSP) documenting implementation status for each requirement.
3.3 The SPRS (Supplier Performance Risk System) score derived from the NIST SP 800-171 self-assessment must be submitted to the DoD Assessment Methodology portal prior to award of applicable contracts.

4. CUI HANDLING REQUIREMENTS
4.1 CUI must be identified and labeled per the CUI Registry (cui.gov) and applicable contract requirements.
4.2 CUI must be protected with controls meeting or exceeding NIST SP 800-171:
- Access restricted to personnel with a need to know
- Encrypted in transit (TLS 1.2+) and at rest (AES-256 or equivalent)
- Stored only on systems within the defined authorization boundary
- Transmitted only through approved, encrypted channels
- Not stored on personal devices unless those devices are MDM-enrolled and encrypted
4.3 CUI must not be processed or stored in non-US cloud environments. All cloud services used for CUI must be FedRAMP authorized.
4.4 Unauthorized disclosure of CUI must be reported to the CISO immediately and to the relevant contracting officer within the required reporting window.

5. AUTHORIZATION BOUNDARY
5.1 [Organization Name] maintains a defined authorization boundary that includes all systems that handle FCI or CUI.
5.2 The boundary must be documented in the System Security Plan and updated within 30 days of significant system changes.
5.3 Cloud service providers used within the boundary must be FedRAMP authorized.

6. SUBCONTRACTOR REQUIREMENTS
6.1 Any subcontractor or supplier who will handle FCI or CUI must be required by contract to: implement NIST SP 800-171, pursue appropriate CMMC certification, submit a SPRS score, report incidents within 72 hours, and flow down these requirements to their own subcontractors.
6.2 [Organization Name] must verify subcontractor CMMC/SPRS compliance status before and periodically during the subcontract period.
6.3 Contracts with subcontractors handling CUI must include the DFARS 252.204-7012 clause.

7. INCIDENT REPORTING OBLIGATIONS
7.1 Any cybersecurity incident that affects covered systems or CUI must be reported to US-CERT (report.cisa.gov) within 72 hours per DFARS 252.204-7012.
7.2 The relevant contracting officer must also be notified within 72 hours.
7.3 [Organization Name] must preserve images of all affected systems for 90 days to support DoD forensic investigation.

8. ASSESSMENT AND CERTIFICATION
8.1 [Organization Name] must conduct an annual self-assessment of NIST SP 800-171 compliance using the DoD Assessment Methodology. Results must be documented and submitted to SPRS.
8.2 For contracts requiring CMMC Level 2 certification: [Organization Name] must engage a C3PAO (CMMC Third-Party Assessment Organization) for a formal triennial assessment.
8.3 All deficiencies identified in assessments must be tracked in the Plan of Action and Milestones (POA&M) with target remediation dates.

9. CONTINUOUS COMPLIANCE
9.1 NIST SP 800-171 compliance must be maintained continuously, not only at assessment time.
9.2 Monthly control effectiveness reviews must be conducted by the Security team.

10. ROLES AND RESPONSIBILITIES
- CISO: Own CMMC compliance; maintain SSP; submit SPRS scores; coordinate C3PAO assessments.
- Security Team: Implement and monitor controls; maintain POA&M; conduct monthly reviews.
- Contracts/Legal: Include required DFARS clauses in subcontracts; verify subcontractor compliance.
- All Personnel Handling CUI: Complete CUI-specific training; follow CUI handling procedures; report incidents.

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]