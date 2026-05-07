import { IAMClient, GetAccountSummaryCommand, GetAccountPasswordPolicyCommand, ListUsersCommand, ListMFADevicesCommand } from "@aws-sdk/client-iam";
import { CloudTrailClient, DescribeTrailsCommand } from "@aws-sdk/client-cloudtrail";
import { S3Client, ListBucketsCommand, GetBucketEncryptionCommand, GetBucketPolicyStatusCommand } from "@aws-sdk/client-s3";
import { GuardDutyClient, ListDetectorsCommand, GetDetectorCommand } from "@aws-sdk/client-guardduty";

export interface AwsCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "aws";
}

export interface AwsEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "aws";
}

export interface AwsSyncResult {
  controlResults: AwsCheckResult[];
  evidenceItems: AwsEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

export async function runAwsChecks(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<AwsSyncResult> {
  const credentials = { accessKeyId, secretAccessKey };
  const iamClient = new IAMClient({ credentials, region: "us-east-1" });
  const cloudTrailClient = new CloudTrailClient({ credentials, region });
  const s3Client = new S3Client({ credentials, region });
  const guardDutyClient = new GuardDutyClient({ credentials, region });

  const controlResults: AwsCheckResult[] = [];
  const evidenceItems: AwsEvidenceItem[] = [];

  // Check 1: Root account MFA
  try {
    const summary = await iamClient.send(new GetAccountSummaryCommand({}));
    const rootMfaEnabled = summary.SummaryMap?.AccountMFAEnabled === 1;
    const userCount = summary.SummaryMap?.Users ?? 0;
    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: rootMfaEnabled ? "passing" : "failing",
      result: `AWS root account MFA: ${rootMfaEnabled ? "enabled" : "NOT enabled - critical risk"}. Account has ${userCount} IAM users.`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AI-001",
      title: "AWS Root Account MFA Status",
      description: `Root account MFA is ${rootMfaEnabled ? "enabled" : "NOT enabled"}. ${userCount} IAM users in account.`,
      type: "auto",
      source: "aws",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: "warning",
      result: `Root MFA check failed: ${String(err)}`,
      integrationKey: "aws",
    });
  }

  // Check 2: IAM password policy
  try {
    const { PasswordPolicy: pp } = await iamClient.send(new GetAccountPasswordPolicyCommand({}));
    const meetsLength = (pp?.MinimumPasswordLength ?? 0) >= 14;
    const hasComplexity = !!(pp?.RequireUppercaseCharacters && pp?.RequireLowercaseCharacters && pp?.RequireNumbers && pp?.RequireSymbols);
    const hasExpiry = !!(pp?.MaxPasswordAge && pp?.MaxPasswordAge <= 90);
    const passing = meetsLength && hasComplexity;
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: passing ? "passing" : "failing",
      result: `IAM password policy: ${pp?.MinimumPasswordLength ?? 0} char min, complexity ${hasComplexity ? "required" : "NOT required"}, expiry ${pp?.MaxPasswordAge ? `${pp.MaxPasswordAge} days` : "none"}`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AC-001",
      title: "AWS IAM Password Policy",
      description: `Min length: ${pp?.MinimumPasswordLength ?? "not set"}. Complexity: ${hasComplexity ? "required" : "not required"}. Expiry: ${pp?.MaxPasswordAge ? `${pp.MaxPasswordAge} days` : "not configured"}.`,
      type: "auto",
      source: "aws",
    });
  } catch {
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "failing",
      result: "No IAM password policy configured - default weak policy applies",
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AC-001",
      title: "AWS IAM Password Policy",
      description: "No custom IAM password policy is configured. AWS default (minimum 8 characters, no complexity) applies.",
      type: "auto",
      source: "aws",
    });
  }

  // Check 3: CloudTrail
  try {
    const { trailList } = await cloudTrailClient.send(new DescribeTrailsCommand({ includeShadowTrails: false }));
    const trails = trailList ?? [];
    const hasTrail = trails.length > 0;
    const multiRegion = trails.some(t => t.IsMultiRegionTrail);
    const logFileValidation = trails.some(t => t.LogFileValidationEnabled);
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: hasTrail && multiRegion ? "passing" : hasTrail ? "warning" : "failing",
      result: `CloudTrail: ${trails.length} trail(s). Multi-region: ${multiRegion ? "yes" : "no"}. Log validation: ${logFileValidation ? "enabled" : "disabled"}.`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AL-001",
      title: "AWS CloudTrail Configuration",
      description: `${trails.length} CloudTrail trail(s) in ${region}. ${multiRegion ? "Multi-region logging enabled." : "Single-region only."} ${logFileValidation ? "Log file validation enabled." : ""}`,
      type: "auto",
      source: "aws",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: "warning",
      result: `CloudTrail check failed: ${String(err)}`,
      integrationKey: "aws",
    });
  }

  // Check 4: S3 encryption at rest + public access
  try {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    const buckets = Buckets ?? [];
    let encryptedCount = 0;
    let publicCount = 0;
    let checked = 0;
    for (const bucket of buckets.slice(0, 20)) {
      if (!bucket.Name) continue;
      // Check encryption
      try {
        const enc = await s3Client.send(new GetBucketEncryptionCommand({ Bucket: bucket.Name }));
        if (enc.ServerSideEncryptionConfiguration?.Rules?.length) encryptedCount++;
      } catch {
        // No encryption configured
      }
      // Check if bucket policy makes it public
      try {
        const ps = await s3Client.send(new GetBucketPolicyStatusCommand({ Bucket: bucket.Name }));
        if (ps.PolicyStatus?.IsPublic) publicCount++;
      } catch {
        // No bucket policy = not public via policy
      }
      checked++;
    }
    const encRatio = checked > 0 ? encryptedCount / checked : 1;
    const hasPublic = publicCount > 0;
    const status = !hasPublic && encRatio >= 0.8 ? "passing" : hasPublic ? "failing" : "warning";
    controlResults.push({
      ucoControlId: "UCO-DP-001",
      status,
      result: `S3 encryption: ${encryptedCount}/${checked} buckets encrypted. Public buckets: ${publicCount}. (${buckets.length} total)`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-DP-001",
      title: "AWS S3 Encryption and Access Audit",
      description: `${encryptedCount} of ${checked} sampled buckets have server-side encryption. ${publicCount} bucket(s) are publicly accessible via policy. ${buckets.length} total buckets.`,
      type: "auto",
      source: "aws",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-DP-001",
      status: "warning",
      result: `S3 check failed: ${String(err)}`,
      integrationKey: "aws",
    });
  }

  // Check 5: GuardDuty
  try {
    const { DetectorIds } = await guardDutyClient.send(new ListDetectorsCommand({}));
    const ids = DetectorIds ?? [];
    let enabled = false;
    if (ids.length > 0) {
      const det = await guardDutyClient.send(new GetDetectorCommand({ DetectorId: ids[0] }));
      enabled = det.Status === "ENABLED";
    }
    controlResults.push({
      ucoControlId: "UCO-VM-001",
      status: enabled ? "passing" : "failing",
      result: `GuardDuty: ${enabled ? "enabled and active" : ids.length > 0 ? "configured but DISABLED" : "not configured in " + region}`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-VM-001",
      title: "AWS GuardDuty Threat Detection",
      description: `GuardDuty is ${enabled ? "enabled and actively monitoring" : "not enabled"} in ${region}.`,
      type: "auto",
      source: "aws",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-VM-001",
      status: "failing",
      result: `GuardDuty check failed: ${String(err)}`,
      integrationKey: "aws",
    });
  }

  // Check 6: IAM user MFA coverage
  try {
    const { Users } = await iamClient.send(new ListUsersCommand({ MaxItems: 50 }));
    const users = Users ?? [];
    let withMfa = 0;
    for (const user of users) {
      if (!user.UserName) continue;
      const { MFADevices } = await iamClient.send(new ListMFADevicesCommand({ UserName: user.UserName }));
      if ((MFADevices ?? []).length > 0) withMfa++;
    }
    const coverage = users.length > 0 ? Math.round((withMfa / users.length) * 100) : 100;
    controlResults.push({
      ucoControlId: "UCO-AI-002",
      status: coverage >= 90 ? "passing" : coverage >= 70 ? "warning" : "failing",
      result: `IAM user MFA: ${withMfa}/${users.length} users enrolled (${coverage}%)`,
      integrationKey: "aws",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AI-002",
      title: "AWS IAM User MFA Enrollment",
      description: `${withMfa} of ${users.length} IAM users have MFA enrolled (${coverage}% coverage). ${users.length >= 50 ? "First 50 users sampled." : ""}`,
      type: "auto",
      source: "aws",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AI-002",
      status: "warning",
      result: `IAM MFA coverage check failed: ${String(err)}`,
      integrationKey: "aws",
    });
  }

  const checksPassed = controlResults.filter(r => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
