IoT & CONNECTED DEVICE SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for Internet of Things (IoT) devices, operational technology (OT), and other connected devices used in [Organization Name] facilities or networks. IoT devices often have limited security capabilities and represent a growing attack surface.

2. SCOPE
This policy applies to all network-connected devices that are not general-purpose computers, including: smart building controls, environmental sensors, IP cameras, badge readers, smart TVs, printers, connected conference room equipment, and any other embedded or purpose-built connected devices.

3. DEVICE PROCUREMENT AND APPROVAL
3.1 IoT/OT devices must be reviewed by IT Security before procurement and deployment.
3.2 Procurement criteria:
- The vendor must have a documented vulnerability disclosure and patch process
- The device must support firmware updates throughout its expected operational life
- The device must support strong authentication (not only default credentials)
3.3 IoT devices must be inventoried at procurement and tracked in the asset management system.

4. NETWORK SEGMENTATION
4.1 IoT devices must be isolated on dedicated network segments (VLANs) separate from:
- Corporate IT networks (employee workstations and servers)
- Production systems and cloud infrastructure
- Guest/visitor networks
4.2 IoT VLANs must have firewall rules that: block IoT-to-corporate traffic by default, limit IoT internet access to required cloud management endpoints only, and block all traffic from the corporate network to IoT devices that is not required for management.

5. HARDENING
5.1 Default credentials must be changed on all IoT devices before deployment.
5.2 Unnecessary services, features, and open ports must be disabled where the device permits.
5.3 Remote management interfaces must be secured: use HTTPS/SSH only, disable Telnet.
5.4 IoT devices must have their firmware updated to the latest available version before deployment.

6. PATCH AND FIRMWARE MANAGEMENT
6.1 Firmware updates for IoT devices must be monitored via vendor security advisories.
6.2 Critical firmware updates must be applied within 30 days of availability.
6.3 IoT devices for which the vendor no longer provides security updates must be isolated with additional compensating controls or replaced.

7. MONITORING
7.1 IoT network segments must be monitored for anomalous behavior: unexpected outbound connections, unusual traffic volumes, connections to known malicious destinations.
7.2 New devices appearing on IoT network segments must generate alerts; unknown device alerts must be investigated within 4 hours.

8. ROLES AND RESPONSIBILITIES
- IT/Facilities: Manage IoT device inventory and network segmentation; apply firmware updates.
- Security Team: Define security requirements; monitor IoT network segments.
- Procurement: Screen IoT devices against this policy before purchase.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]