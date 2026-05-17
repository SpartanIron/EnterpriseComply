import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db,
  orgZtaAssessmentsTable,
  orgZtaPillarScoresTable,
  orgZtaFunctionScoresTable,
  orgZtaGapFindingsTable,
  orgZtaRemediationItemsTable,
  orgZtaScoreHistoryTable,
  orgZtaEvidenceArtifactsTable,
  orgControlResultsTable,
  orgIntegrationsTable,
} from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";

// ZTMM v2.0 Pillar/Function Definitions (CISA ZTMM v2.0, April 2023)
export const ZTMM_PILLARS = {
  identity: {
    label: "Identity",
    functions: {
      identity_governance: { label: "Identity Governance", nistControls: ["AC-1","AC-2","AC-5","AC-6","IA-1","IA-4","IA-5"] },
      user_authentication: { label: "User Authentication", nistControls: ["IA-2","IA-5","IA-8","IA-11"] },
      mfa_phishing_resistant: { label: "MFA (Phishing-Resistant)", nistControls: ["IA-2(1)","IA-2(2)","IA-2(6)","IA-2(8)"] },
      least_privilege: { label: "Least Privilege Access", nistControls: ["AC-2","AC-3","AC-6","AC-17"] },
      privileged_access: { label: "Privileged Access Management", nistControls: ["AC-2(7)","AC-3","AC-6(2)","AU-9(4)"] },
      visibility_analytics: { label: "Visibility & Analytics", nistControls: ["AU-2","AU-6","AU-12","SI-4"] },
    },
    integrations: ["Entra ID","Duo Security","PingIdentity","Auth0","SailPoint","CyberArk","BeyondTrust","Okta","Google Workspace"],
  },
  devices: {
    label: "Devices",
    functions: {
      device_inventory: { label: "Device Inventory & Enumeration", nistControls: ["CM-8","PM-5","SA-3"] },
      device_compliance: { label: "Device Compliance & Health", nistControls: ["CM-2","CM-6","CM-7","SI-3"] },
      endpoint_detection: { label: "Endpoint Detection & Response", nistControls: ["SI-3","SI-4","IR-4","RA-5"] },
      patch_management: { label: "Patch Management", nistControls: ["CM-2","SI-2","RA-5(2)"] },
      device_authorization: { label: "Device Authorization for Network", nistControls: ["AC-3","AC-17","IA-3","SC-7"] },
      visibility_analytics: { label: "Visibility & Analytics", nistControls: ["AU-2","AU-6","CM-8","SI-4"] },
    },
    integrations: ["CrowdStrike Falcon","SentinelOne","Jamf Pro","Microsoft Intune","Tenable.io","Qualys VMDR"],
  },
  networks: {
    label: "Networks",
    functions: {
      network_segmentation: { label: "Network Segmentation & Micro-seg", nistControls: ["AC-4","SC-7","SC-7(5)"] },
      encrypted_traffic: { label: "Encrypted Traffic Inspection", nistControls: ["SC-8","SC-8(1)","SC-28"] },
      dns_http_filtering: { label: "DNS/HTTP Filtering", nistControls: ["SC-7","SC-20","SC-21"] },
      ztna: { label: "Zero Trust Network Access (ZTNA)", nistControls: ["AC-17","AC-17(2)","SC-7"] },
      network_visibility: { label: "Network Visibility & Analytics", nistControls: ["AU-2","CA-7","SC-7","SI-4"] },
    },
    integrations: ["Cloudflare","AWS Security Hub","AWS Config","AWS GuardDuty","GCP Security Command Center","Prisma Cloud","Wiz"],
  },
  applications: {
    label: "Applications & Workloads",
    functions: {
      application_inventory: { label: "Application Inventory & Risk Profiling", nistControls: ["CA-3","CM-8","PM-5"] },
      sast_dast: { label: "SAST / DAST in CI/CD", nistControls: ["CA-7","RA-5","SA-11","SA-11(1)"] },
      api_security: { label: "API Security & Authorization", nistControls: ["AC-3","AC-4","IA-2","SC-8"] },
      workload_isolation: { label: "Workload Isolation (Containers/K8s)", nistControls: ["CM-7","SC-7","SC-39"] },
      secure_sdlc: { label: "Secure SDLC & Change Management", nistControls: ["CM-3","CM-4","SA-8","SA-11"] },
      app_visibility: { label: "App Visibility & Analytics", nistControls: ["AU-2","CA-7","RA-5","SI-4"] },
    },
    integrations: ["GitHub","GitLab","Snyk","Veracode","Checkmarx","Kubernetes","GitHub Actions","CircleCI","Jenkins"],
  },
  data: {
    label: "Data",
    functions: {
      data_inventory: { label: "Data Inventory & Classification", nistControls: ["CM-8","MP-1","RA-2","SI-12"] },
      data_encryption: { label: "Data Encryption at Rest & Transit", nistControls: ["SC-8","SC-13","SC-28"] },
      secrets_management: { label: "Secrets & Key Management", nistControls: ["IA-5","SC-12","SC-13","SC-17"] },
      data_access_control: { label: "Data Access Controls & DLP", nistControls: ["AC-3","AC-16","AC-23","MP-2"] },
      data_visibility: { label: "Data Visibility & Analytics", nistControls: ["AU-2","AU-9","CA-7","SI-4"] },
    },
    integrations: ["HashiCorp Vault","AWS Secrets Manager","Azure Key Vault","Microsoft 365","Proofpoint"],
  },
};

// UCO to ZTMM Bridge Table
export const UCO_ZTMM_BRIDGE = {
  "UCO-AI-001": { pillar: "identity", functionKey: "mfa_phishing_resistant", nistControls: ["IA-2(1)","IA-2(2)","IA-2(6)"], evidenceArtifact: "MFA enrollment per user with factor type: phishing-resistant vs non-phishing-resistant" },
  "UCO-AI-002": { pillar: "identity", functionKey: "user_authentication", nistControls: ["IA-2","IA-8"], evidenceArtifact: "SSO session logs with auth method, provider, token lifetime per application" },
  "UCO-AC-001": { pillar: "identity", functionKey: "least_privilege", nistControls: ["AC-2","AC-3","AC-6"], evidenceArtifact: "RBAC role assignments per user with last-used date and over-privileged account flags" },
  "UCO-AC-002": { pillar: "identity", functionKey: "identity_governance", nistControls: ["AC-2","AC-6"], evidenceArtifact: "Access review completion records with reviewer, date, outcome, exceptions" },
  "UCO-DP-001": { pillar: "data", functionKey: "data_inventory", nistControls: ["CM-8","RA-2"], evidenceArtifact: "Data classification labels on storage objects with sensitivity tier and owner" },
  "UCO-DP-002": { pillar: "data", functionKey: "data_encryption", nistControls: ["SC-8","SC-13","SC-28"], evidenceArtifact: "Encryption config per data store: algorithm, key length, FIPS validation status" },
  "UCO-VM-001": { pillar: "devices", functionKey: "patch_management", nistControls: ["CM-2","SI-2","RA-5"], evidenceArtifact: "Vuln scan results per endpoint: CVE IDs, CVSS, patch SLA compliance (30/60/90 day)" },
  "UCO-AL-001": { pillar: "networks", functionKey: "network_visibility", nistControls: ["AU-2","AU-6","CA-7"], evidenceArtifact: "Centralized log collection coverage: sources, volume, retention, gap analysis" },
  "UCO-IR-001": { pillar: "applications", functionKey: "app_visibility", nistControls: ["IR-4","IR-5","SI-4"], evidenceArtifact: "Incident detection alerts with MTTD/MTTR metrics and SOC escalation path" },
  "UCO-CM-001": { pillar: "applications", functionKey: "secure_sdlc", nistControls: ["CM-3","CM-4","SA-11"], evidenceArtifact: "Change records: PR approval rate, CODEOWNERS coverage, security gate pass/fail" },
  "UCO-ST-001": { pillar: "identity", functionKey: "visibility_analytics", nistControls: ["AT-2","AT-3","SI-4"], evidenceArtifact: "Security awareness training completion rates with phishing simulation results" },
  "UCO-ST-002": { pillar: "data", functionKey: "data_access_control", nistControls: ["AC-3","AC-16","MP-2"], evidenceArtifact: "DLP policy coverage map: policies per sensitivity tier, incident counts, FP rate" },
};

// Cross-Pillar Dependency Rules (15 rules, directional)
export const DEPENDENCY_RULES = [
  { id: "DEP-001", sourcePillar: "devices", sourceMinStage: "initial", targetPillar: "identity", targetMaxStage: "initial", rationale: "Conditional access policies require device trust signals. Without Initial device posture, identity cannot exceed Initial maturity." },
  { id: "DEP-002", sourcePillar: "identity", sourceMinStage: "initial", targetPillar: "data", targetMaxStage: "initial", rationale: "Data access control depends on identity claims. Without Initial identity (MFA+RBAC), Data cannot reach Advanced." },
  { id: "DEP-003", sourcePillar: "networks", sourceMinStage: "initial", targetPillar: "applications", targetMaxStage: "initial", rationale: "App-layer ZT controls require network segmentation. Apps cannot reach Advanced if Networks is Traditional." },
  { id: "DEP-004", sourcePillar: "identity", sourceMinStage: "advanced", targetPillar: "data", targetMaxStage: "advanced", rationale: "Data Optimal requires continuous access decisions from identity risk scores. Needs Advanced identity." },
  { id: "DEP-005", sourcePillar: "devices", sourceMinStage: "advanced", targetPillar: "applications", targetMaxStage: "advanced", rationale: "App workload authorization at Optimal requires continuous device health signals from Advanced EDR." },
  { id: "DEP-006", sourcePillar: "networks", sourceMinStage: "advanced", targetPillar: "data", targetMaxStage: "advanced", rationale: "Advanced data protection (DLP at network layer) requires Advanced network visibility." },
  { id: "DEP-007", sourcePillar: "applications", sourceMinStage: "initial", targetPillar: "data", targetMaxStage: "initial", rationale: "Data above Initial requires app-level data tagging. Traditional Apps means no app-level classification." },
  { id: "DEP-008", sourcePillar: "identity", sourceMinStage: "initial", targetPillar: "networks", targetMaxStage: "initial", rationale: "ZTNA policies depend on authenticated identity claims. Without Initial identity, network cannot be identity-driven." },
  { id: "DEP-009", sourcePillar: "devices", sourceMinStage: "initial", targetPillar: "networks", targetMaxStage: "initial", rationale: "NAC/device cert policies require Initial device inventory and compliance checking." },
  { id: "DEP-010", sourcePillar: "identity", sourceMinStage: "advanced", targetPillar: "applications", targetMaxStage: "advanced", rationale: "App Optimal requires continuous auth eval (step-up, risk-adaptive). Needs Advanced identity." },
  { id: "DEP-011", sourcePillar: "networks", sourceMinStage: "initial", targetPillar: "data", targetMaxStage: "traditional", rationale: "Without network segmentation, data exfiltration prevention at perimeter is impossible. Data capped at Traditional." },
  { id: "DEP-012", sourcePillar: "applications", sourceMinStage: "advanced", targetPillar: "networks", targetMaxStage: "advanced", rationale: "Network Optimal (micro-seg driven by app topology) requires Advanced app inventory." },
  { id: "DEP-013", sourcePillar: "devices", sourceMinStage: "advanced", targetPillar: "identity", targetMaxStage: "optimal", rationale: "Identity Optimal (continuous risk-adaptive auth) requires device health signals from Advanced EDR." },
  { id: "DEP-014", sourcePillar: "data", sourceMinStage: "initial", targetPillar: "applications", targetMaxStage: "advanced", rationale: "App Advanced (data-aware API policies) requires Initial data classification." },
  { id: "DEP-015", sourcePillar: "identity", sourceMinStage: "initial", targetPillar: "devices", targetMaxStage: "initial", rationale: "Device auth for network requires identity-bound device certs. Without Initial identity, device identity cannot be established." },
];

const STAGE_THRESHOLDS = { traditional: 0, initial: 25, advanced: 50, optimal: 75 };
function scoreToStage(score) {
  if (score >= 75) return "optimal";
  if (score >= 50) return "advanced";
  if (score >= 25) return "initial";
  return "traditional";
}
function stageToMinScore(stage) {
  return STAGE_THRESHOLDS[stage] || 0;
}

@Injectable()
export class ZeroTrustService {
  async getOrCreate(orgId, clerkUserId) {
    const existing = await db.query.orgZtaAssessmentsTable.findFirst({
      where: eq(orgZtaAssessmentsTable.orgId, orgId),
      orderBy: [desc(orgZtaAssessmentsTable.createdAt)],
    });
    if (existing) return { assessment: existing };
    const [created] = await db.insert(orgZtaAssessmentsTable).values({
      orgId, name: "Zero Trust Assessment", createdBy: clerkUserId,
    }).returning();
    return { assessment: created };
  }

  async getAssessment(orgId) {
    const assessment = await db.query.orgZtaAssessmentsTable.findFirst({
      where: eq(orgZtaAssessmentsTable.orgId, orgId),
      orderBy: [desc(orgZtaAssessmentsTable.createdAt)],
    });
    if (!assessment) return { assessment: null, pillarScores: [], functionScores: [], gapFindings: [], remediationItems: [] };
    const [pillarScores, functionScores, gapFindings, remediationItems] = await Promise.all([
      db.query.orgZtaPillarScoresTable.findMany({ where: eq(orgZtaPillarScoresTable.ztaAssessmentId, assessment.id) }),
      db.query.orgZtaFunctionScoresTable.findMany({ where: eq(orgZtaFunctionScoresTable.ztaAssessmentId, assessment.id) }),
      db.query.orgZtaGapFindingsTable.findMany({ where: and(eq(orgZtaGapFindingsTable.ztaAssessmentId, assessment.id), eq(orgZtaGapFindingsTable.status, "open")) }),
      db.query.orgZtaRemediationItemsTable.findMany({ where: and(eq(orgZtaRemediationItemsTable.ztaAssessmentId, assessment.id), eq(orgZtaRemediationItemsTable.status, "open")) }),
    ]);
    return { assessment, pillarScores, functionScores, gapFindings, remediationItems };
  }

  async score(orgId, clerkUserId) {
    const { assessment } = await this.getOrCreate(orgId, clerkUserId);
    const controlResults = await db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) });
    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));
    const integrations = await db.query.orgIntegrationsTable.findMany({ where: eq(orgIntegrationsTable.orgId, orgId) });
    const connectedIntegrations = new Set(integrations.filter(i => i.status === "active").map(i => i.name));
    const pillarScoreMap = {};
    for (const [pillarKey, pillarDef] of Object.entries(ZTMM_PILLARS)) {
      const functionScoreMap = {};
      for (const [funcKey, funcDef] of Object.entries(pillarDef.functions)) {
        const relevantUCO = Object.entries(UCO_ZTMM_BRIDGE).filter(([, b]) => b.pillar === pillarKey && b.functionKey === funcKey);
        let funcScore = 0; let totalWeight = 0;
        if (relevantUCO.length === 0) {
          const cc = pillarDef.integrations.filter(i => connectedIntegrations.has(i)).length;
          functionScoreMap[funcKey] = Math.round((cc / pillarDef.integrations.length) * 40);
          continue;
        }
        for (const [ucoId] of relevantUCO) {
          const result = resultMap.get(ucoId);
          const weight = result ? 1.0 : 0.6; totalWeight += weight;
          if (result?.status === "passing") funcScore += weight * 100;
          else if (result?.status === "partial") funcScore += weight * 50;
          else if (!result) {
            if (pillarDef.integrations.some(i => connectedIntegrations.has(i))) { funcScore += weight * 20; totalWeight += weight; }
          }
        }
        functionScoreMap[funcKey] = totalWeight > 0 ? Math.round(funcScore / totalWeight) : 0;
      }
      const vals = Object.values(functionScoreMap);
      const rawScore = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      pillarScoreMap[pillarKey] = { raw: rawScore, stage: scoreToStage(rawScore), functionScores: functionScoreMap };
    }
    const cappedScores = {};
    for (const pk of Object.keys(ZTMM_PILLARS)) cappedScores[pk] = { capped: pillarScoreMap[pk]?.raw ?? 0, stage: pillarScoreMap[pk]?.stage ?? "traditional", violations: [] };
    const violations = [];
    for (const rule of DEPENDENCY_RULES) {
      const sourceStage = pillarScoreMap[rule.sourcePillar]?.stage ?? "traditional";
      const sourceOk = stageToMinScore(sourceStage) >= stageToMinScore(rule.sourceMinStage);
      if (!sourceOk) {
        const targetMaxScore = stageToMinScore(rule.targetMaxStage) + 24;
        if ((cappedScores[rule.targetPillar]?.capped ?? 0) > targetMaxScore) {
          cappedScores[rule.targetPillar].capped = targetMaxScore;
          cappedScores[rule.targetPillar].stage = scoreToStage(targetMaxScore);
          cappedScores[rule.targetPillar].violations.push(rule.id);
          violations.push({ ruleId: rule.id, sourcePillar: rule.sourcePillar, targetPillar: rule.targetPillar, explanation: rule.rationale });
        }
      }
    }
    const pks = Object.keys(ZTMM_PILLARS);
    const overallScore = Math.round(pks.reduce((s, pk) => s + (cappedScores[pk]?.capped ?? 0), 0) / pks.length);
    const overallStage = scoreToStage(overallScore);
    const ragStatus = overallScore >= 75 ? "green" : overallScore >= 50 ? "amber" : "red";
    const pillarScoresObj = {};
    for (const pk of pks) pillarScoresObj[pk] = cappedScores[pk]?.capped ?? 0;
    await db.delete(orgZtaPillarScoresTable).where(eq(orgZtaPillarScoresTable.ztaAssessmentId, assessment.id));
    for (const [pk, data] of Object.entries(cappedScores)) {
      await db.insert(orgZtaPillarScoresTable).values({ orgId, ztaAssessmentId: assessment.id, pillar: pk, rawScore: pillarScoreMap[pk]?.raw ?? 0, cappedScore: data.capped, maturityStage: data.stage, weight: 1.0, functionScores: pillarScoreMap[pk]?.functionScores ?? {} });
    }
    await db.delete(orgZtaFunctionScoresTable).where(eq(orgZtaFunctionScoresTable.ztaAssessmentId, assessment.id));
    for (const [pk, pd] of Object.entries(pillarScoreMap)) {
      const pDef = ZTMM_PILLARS[pk];
      for (const [fk, fs] of Object.entries(pd.functionScores)) {
        const fd = pDef.functions[fk];
        const ucoIds = Object.entries(UCO_ZTMM_BRIDGE).filter(([, b]) => b.pillar === pk && b.functionKey === fk).map(([id]) => id);
        await db.insert(orgZtaFunctionScoresTable).values({ orgId, ztaAssessmentId: assessment.id, pillar: pk, functionKey: fk, functionLabel: fd?.label ?? fk, maturityStage: scoreToStage(fs), score: fs, nistControls: fd?.nistControls ?? [], ucoControls: ucoIds });
      }
    }
    await db.delete(orgZtaGapFindingsTable).where(and(eq(orgZtaGapFindingsTable.ztaAssessmentId, assessment.id), eq(orgZtaGapFindingsTable.status, "open")));
    for (const [pk, data] of Object.entries(cappedScores)) {
      if (data.stage !== "optimal") {
        const pDef = ZTMM_PILLARS[pk];
        const targetStage = data.stage === "traditional" ? "initial" : data.stage === "initial" ? "advanced" : "optimal";
        const sev = data.capped < 25 ? "critical" : data.capped < 50 ? "high" : "medium";
        const failingUco = Object.entries(UCO_ZTMM_BRIDGE).filter(([id, b]) => b.pillar === pk && resultMap.get(id)?.status !== "passing").map(([id]) => id);
        const failingNist = failingUco.flatMap(id => UCO_ZTMM_BRIDGE[id]?.nistControls ?? []);
        await db.insert(orgZtaGapFindingsTable).values({ orgId, ztaAssessmentId: assessment.id, pillar: pk, functionKey: "pillar_overall", currentStage: data.stage, targetStage, gapTitle: pDef.label + " pillar at " + data.stage + " — target: " + targetStage, gapDescription: data.violations.length ? "Score capped by dependency rules: " + data.violations.join(", ") : pDef.label + " scored " + data.capped + "% — insufficient evidence for " + targetStage + " maturity.", severity: sev, failingNistControls: failingNist, failingUcoControls: failingUco, causesDependencyViolation: data.violations.length > 0, status: "open" });
      }
    }
    await db.update(orgZtaAssessmentsTable).set({ overallScore, overallMaturityLevel: overallStage, pillarScores: pillarScoresObj, ragStatus, dependencyViolations: violations, scoredAt: new Date() }).where(eq(orgZtaAssessmentsTable.id, assessment.id));
    await db.insert(orgZtaScoreHistoryTable).values({ orgId, ztaAssessmentId: assessment.id, overallScore, pillarScores: pillarScoresObj, maturityLevel: overallStage, triggerType: "manual" });
    return { assessment: { ...assessment, overallScore, overallMaturityLevel: overallStage, pillarScores: pillarScoresObj, ragStatus }, pillarScores: Object.entries(cappedScores).map(([pillar, d]) => ({ pillar, label: ZTMM_PILLARS[pillar]?.label ?? pillar, rawScore: pillarScoreMap[pillar]?.raw ?? 0, cappedScore: d.capped, maturityStage: d.stage, violations: d.violations, functionScores: pillarScoreMap[pillar]?.functionScores ?? {} })), overallScore, overallStage, ragStatus, dependencyViolations: violations };
  }

  async getTrend(orgId, days = 90) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const history = await db.query.orgZtaScoreHistoryTable.findMany({ where: and(eq(orgZtaScoreHistoryTable.orgId, orgId), gte(orgZtaScoreHistoryTable.snapshotDate, since)), orderBy: [desc(orgZtaScoreHistoryTable.snapshotDate)] });
    return { history, days };
  }

  async getGapFindings(orgId) {
    const a = await db.query.orgZtaAssessmentsTable.findFirst({ where: eq(orgZtaAssessmentsTable.orgId, orgId), orderBy: [desc(orgZtaAssessmentsTable.createdAt)] });
    if (!a) return { findings: [] };
    const findings = await db.query.orgZtaGapFindingsTable.findMany({ where: eq(orgZtaGapFindingsTable.ztaAssessmentId, a.id), orderBy: [desc(orgZtaGapFindingsTable.severity)] });
    return { findings };
  }

  async getCrosswalk() {
    const rows = [];
    for (const [pk, pd] of Object.entries(ZTMM_PILLARS)) {
      for (const [fk, fd] of Object.entries(pd.functions)) {
        const ucoMappings = Object.entries(UCO_ZTMM_BRIDGE).filter(([, b]) => b.pillar === pk && b.functionKey === fk);
        rows.push({ pillar: pk, pillarLabel: pd.label, function: fk, functionLabel: fd.label, nistControls: fd.nistControls ?? [], ucoControls: ucoMappings.map(([id]) => id), evidenceArtifact: ucoMappings[0]?.[1]?.evidenceArtifact ?? "Manual attestation required" });
      }
    }
    return { crosswalk: rows, dependencyRules: DEPENDENCY_RULES };
  }

  async updateWeights(orgId, weights) {
    const a = await db.query.orgZtaAssessmentsTable.findFirst({ where: eq(orgZtaAssessmentsTable.orgId, orgId), orderBy: [desc(orgZtaAssessmentsTable.createdAt)] });
    if (!a) throw new NotFoundException("No ZTA assessment found");
    await db.update(orgZtaAssessmentsTable).set({ pillarWeights: weights }).where(eq(orgZtaAssessmentsTable.id, a.id));
    return { weights };
  }
}
