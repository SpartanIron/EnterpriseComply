MOBILE DEVICE & BYOD POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for corporate-owned mobile devices and personally-owned devices (BYOD - Bring Your Own Device) that access [Organization Name] systems, email, or data. Mobile devices represent a significant risk vector due to their portability, connectivity, and exposure to physical loss.

2. SCOPE
This policy applies to all smartphones, tablets, and laptops - both corporate-owned and personally-owned - used to access [Organization Name] email, applications, or data.

3. DEVICE CATEGORIES AND APPROVAL
3.1 Corporate-owned devices: Issued and fully managed by IT. All policies apply without exception.
3.2 BYOD devices: Personally-owned devices approved for limited organizational use. BYOD is permitted for email and approved productivity applications only. BYOD devices must not be used to access Restricted or CUI data without explicit written approval and enhanced controls.
3.3 Devices operating on unsupported OS versions (end-of-life from the manufacturer) are not permitted to access organizational systems.

4. MDM ENROLLMENT
4.1 All devices (corporate and approved BYOD) must be enrolled in [Organization Name]'s MDM solution before accessing organizational resources.
4.2 MDM enrollment grants IT the ability to: enforce security configurations, push approved applications, locate the device, remotely lock the device, and remotely wipe the device in the event of loss or theft.
4.3 For BYOD devices, MDM applies a managed profile/container. Only data within the managed container (organizational apps and data) is accessible to IT. Personal apps, photos, and data outside the managed container are not accessible to the organization.

5. SECURITY REQUIREMENTS
5.1 All enrolled devices must meet these minimum security requirements enforced via MDM:
- Screen lock with PIN (minimum 6 digits), passphrase, or biometric after 5 minutes of inactivity
- Full device encryption enabled (required on iOS and Android by default; must be verified)
- Latest available OS version (or within 1 major version)
- Latest available security patches (within 30 days of release)
- Approved endpoint protection/EDR application installed where available
- Remote wipe capability enabled and tested
5.2 Jailbroken or rooted devices are prohibited from accessing organizational systems. MDM must detect and block jailbroken/rooted status.
5.3 Applications from unofficial sources (sideloading) are prohibited on enrolled devices.

6. REMOTE WIPE
6.1 If a device is lost, stolen, or the employee is separated, IT will initiate a remote wipe without additional approval.
6.2 For BYOD devices, remote wipe targets only the managed organizational container/profile. Personal data outside the managed profile is not affected.
6.3 Employees must report lost or stolen devices to IT within 1 hour of discovery. Failure to report promptly may result in a data breach notification obligation.

7. APPLICATION MANAGEMENT
7.1 Organizational applications must be installed only from the MDM-managed enterprise app catalog or approved public app stores.
7.2 Employees must not use personal cloud sync applications (personal Dropbox, personal iCloud) to store or transfer organizational data.
7.3 Organizational data must not be copied to personal applications or personal storage.

8. PRIVACY (BYOD)
For BYOD devices, [Organization Name] collects only data relevant to the managed profile: installed managed apps, device security posture (encryption, OS version, screen lock), and device location during active MDM sessions. The organization does not collect personal browsing history, personal app data, photos, or communications.

9. ROLES AND RESPONSIBILITIES
- IT/MDM Team: Configure and maintain MDM; enroll devices; respond to loss/theft; perform remote wipes.
- All Employees: Comply with enrollment requirements; report lost/stolen devices immediately.
- Managers: Ensure team members understand and comply with this policy.

10. ENFORCEMENT
Devices that do not meet MDM compliance requirements will be blocked from accessing organizational resources. Circumventing MDM controls may result in disciplinary action.

Policy Owner: [CISO / IT Manager]
Effective Date: [DATE]
Next Review: [DATE]