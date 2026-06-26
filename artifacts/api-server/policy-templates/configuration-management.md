CONFIGURATION MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for maintaining secure, consistent, and documented configurations for all [Organization Name] systems, reducing attack surface and preventing unauthorized configuration changes. This policy satisfies CMMC CM.2.061/CM.2.062, FedRAMP CM-6/CM-7, and SOC 2 CC8.1.

2. SCOPE
This policy applies to all systems within the [Organization Name] authorization boundary: servers, workstations, cloud instances, network devices, containers, and security appliances.

3. SECURITY BASELINE CONFIGURATIONS
3.1 Security baseline configurations must be defined for each major system type using industry-recognized benchmarks:
- Servers (Linux): CIS Benchmark for the specific distribution (minimum Level 1)
- Servers (Windows): CIS Benchmark for Windows Server (minimum Level 1) or STIG
- Workstations (macOS/Windows): CIS Benchmark or vendor security baseline (minimum Level 1)
- Cloud infrastructure (AWS/Azure/GCP): CIS Cloud Benchmark for the relevant provider
- Containers: CIS Benchmark for Docker/Kubernetes (minimum Level 1)
3.2 Baseline configurations must be documented and version-controlled.
3.3 Systems must not be deployed to production without being configured to the baseline.

4. HARDENING REQUIREMENTS
4.1 Default credentials must always be changed before deployment.
4.2 All unnecessary services, protocols, and ports must be disabled.
4.3 OS and application logging must be enabled and configured to forward to the SIEM.
4.4 Remote management interfaces must be restricted to the management network only.

5. INFRASTRUCTURE AS CODE
5.1 All cloud infrastructure and server provisioning must be managed as code (Terraform, CloudFormation, Ansible, or equivalent). Manual configuration changes to production systems are prohibited except in documented emergencies.
5.2 IaC must be version-controlled with appropriate access controls and reviewed before merging.
5.3 IaC templates must be scanned for security misconfigurations before deployment.
5.4 Post-emergency: IaC must be updated to reflect emergency changes within 48 hours.

6. CONFIGURATION DRIFT DETECTION
6.1 A configuration drift detection tool must be deployed to continuously compare actual system configurations against approved baselines.
6.2 Detected drift must generate alerts within 1 hour of detection.
6.3 Unauthorized configuration changes must be investigated as potential security incidents.
6.4 Drift from security baseline: Remediate within 72 hours (treat as High severity vulnerability).
6.5 Drift from operational baseline (non-security): Remediate within 7 days.

7. CHANGE MANAGEMENT
All changes to production system configurations must follow the Change Management Policy. Emergency changes that bypass the standard process must be documented and reviewed within 24 hours.

8. ROLES AND RESPONSIBILITIES
- IT/DevOps: Define and implement baselines; operate IaC; respond to drift alerts.
- Security Team: Define baseline security requirements; review IaC; investigate unauthorized changes.
- System Owners: Ensure systems comply with baselines; not make manual production changes.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]