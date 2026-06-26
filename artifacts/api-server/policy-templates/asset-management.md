ASSET MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for the identification, classification, tracking, and lifecycle management of hardware and software assets owned or managed by [Organization Name]. Complete and accurate asset inventory is the foundation of effective security management.

2. SCOPE
This policy covers: all hardware assets (servers, workstations, laptops, mobile devices, network equipment, printers, and storage media), all software assets (licensed software, open source dependencies, SaaS subscriptions), and all cloud resources provisioned by the organization.

3. ASSET INVENTORY
3.1 [Organization Name] must maintain a current, complete asset inventory updated within 5 business days of any asset addition, change, or removal.
3.2 For each hardware asset: unique asset identifier/tag, asset type, manufacturer/model, serial number, assigned user or location, operating system and version, purchase date, warranty expiry, and current status.
3.3 For each software asset: software name and version, vendor, license type and quantity, license expiry, systems installed on, and business owner.
3.4 Cloud resources must be inventoried via cloud-native tagging: Owner, Environment, Data classification, and Cost center.
3.5 Asset inventory must be reviewed and reconciled against physical/logical reality at least annually.

4. ASSET CLASSIFICATION
All assets must be classified based on the highest classification of data they process or store: Restricted/CUI, Confidential, Internal, or Public. Classification determines the security controls required.

5. HARDWARE LIFECYCLE
5.1 Procurement: All hardware must be sourced from approved vendors. New assets must be registered in inventory before deployment.
5.2 Deployment: New devices must be configured to the security baseline before connection to organizational networks.
5.3 Maintenance: Hardware assets must be maintained per manufacturer support schedules; end-of-life assets must have a documented remediation plan.
5.4 Decommissioning: Before disposal, all storage media must be sanitized per NIST SP 800-88. A decommission record must document the asset ID, disposition date, and sanitization method.

6. SOFTWARE LIFECYCLE
6.1 Only approved software may be installed on organizational systems.
6.2 End-of-life or unsupported software that receives no further security patches must be removed or isolated; compensating controls must be documented.
6.3 Open source software used in organizational systems must be tracked in a Software Bill of Materials (SBOM) and reviewed for license compliance.

7. LOST OR STOLEN ASSETS
7.1 Any lost or stolen organizational asset must be reported to IT and the Security team within 1 hour of discovery.
7.2 Incidents involving lost/stolen devices containing Confidential or Restricted data must be treated as potential data breaches.

8. ROLES AND RESPONSIBILITIES
- IT: Maintain asset inventory; provision and decommission hardware; manage software licenses.
- All Employees: Report asset changes (lost, stolen, broken, returned); do not install unauthorized software.
- Security Team: Audit asset inventory; review decommission records.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]