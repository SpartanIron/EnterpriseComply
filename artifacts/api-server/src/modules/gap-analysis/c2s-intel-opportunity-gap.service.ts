import { Injectable, Logger } from "@nestjs/common";
import { db, orgControlResultsTable, orgFrameworksTable, ucoControlsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── C2S Intel Framework Requirement Map ───────────────────────────────────
// Maps contract vehicle types to required compliance frameworks + controls.
// Sourced from: DFARS 252.204-7012, CMMC 2.0, FedRAMP authorization requirements.
const FRAMEWORK_REQUIREMENTS: Record<string, {
  frameworkKeys: string[];
  requiredControlIds: string[];
  minimumScore: number;
  description: string;
}> = {
  "CMMC_L1": {
    frameworkKeys: ["cmmc"],
    requiredControlIds: ["UCO-AC-001", "UCO-AC-003", "UCO-AL-001", "UCO-DP-001", "UCO-VM-001"],
    minimumScore: 100,
    description: "CMMC Level 1 — 17 practices, required for all DoD contracts handling FCI",
  },
  "CMMC_L2": {
    frameworkKeys: ["cmmc"],
    requiredControlIds: [
      "UCO-AC-001", "UCO-AC-002", "UCO-AC-003", "UCO-AI-001", "UCO-AI-002",
      "UCO-AL-001", "UCO-AL-002", "UCO-CM-001", "UCO-CM-002", "UCO-DP-001",
      "UCO-DP-002", "UCO-DP-003", "UCO-IR-001", "UCO-NS-001", "UCO-NS-002",
      "UCO-VM-001", "UCO-VM-002", "UCO-AT-001",
    ],
    minimumScore: 80,
    description: "CMMC Level 2 — 110 NIST 800-171 practices, required for CUI contracts",
  },
  "CMMC_L3": {
    frameworkKeys: ["cmmc", "nist-800-171"],
    requiredControlIds: [
      "UCO-AC-001", "UCO-AC-002", "UCO-AC-003", "UCO-AI-001", "UCO-AI-002",
      "UCO-AL-001", "UCO-AL-002", "UCO-CM-001", "UCO-CM-002", "UCO-CM-003",
      "UCO-DP-001", "UCO-DP-002", "UCO-DP-003", "UCO-IR-001", "UCO-IR-002",
      "UCO-NS-001", "UCO-NS-002", "UCO-VM-001", "UCO-VM-002", "UCO-AT-001",
    ],
    minimumScore: 90,
    description: "CMMC Level 3 — NIST 800-172, required for highest-value DoD programs",
  },
  "FEDRAMP_LI_SAAS": {
    frameworkKeys: ["fedramp"],
    requiredControlIds: ["UCO-AC-001", "UCO-AI-001", "UCO-AL-001", "UCO-DP-002", "UCO-VM-001"],
    minimumScore: 75,
    description: "FedRAMP Li-SaaS — for low-risk cloud services used by federal agencies",
  },
  "FEDRAMP_MODERATE": {
    frameworkKeys: ["fedramp"],
    requiredControlIds: [
      "UCO-AC-001", "UCO-AC-002", "UCO-AC-003", "UCO-AI-001", "UCO-AI-002",
      "UCO-AL-001", "UCO-AL-002", "UCO-CM-001", "UCO-DP-001", "UCO-DP-002",
      "UCO-DP-003", "UCO-IR-001", "UCO-NS-001", "UCO-NS-002", "UCO-VM-001",
    ],
    minimumScore: 85,
    description: "FedRAMP Moderate — for cloud services hosting moderate-impact federal data",
  },
  "FEDRAMP_HIGH": {
    frameworkKeys: ["fedramp"],
    requiredControlIds: [
      "UCO-AC-001", "UCO-AC-002", "UCO-AC-003", "UCO-AI-001", "UCO-AI-002",
      "UCO-AL-001", "UCO-AL-002", "UCO-CM-001", "UCO-CM-002", "UCO-CM-003",
      "UCO-DP-001", "UCO-DP-002", "UCO-DP-003", "UCO-IR-001", "UCO-IR-002",
      "UCO-NS-001", "UCO-NS-002", "UCO-VM-001", "UCO-VM-002",
    ],
    minimumScore: 95,
    description: "FedRAMP High — for high-impact federal systems (law enforcement, health)",
  },
  "ITAR": {
    frameworkKeys: ["cmmc", "nist-800-171"],
    requiredControlIds: ["UCO-AC-001", "UCO-AC-003", "UCO-DP-001", "UCO-DP-002", "UCO-NS-001"],
    minimumScore: 80,
    description: "ITAR compliance — export-controlled defense articles and services",
  },
  "SOC2_TYPE2": {
    frameworkKeys: ["soc2"],
    requiredControlIds: [
      "UCO-AC-001", "UCO-AC-002", "UCO-AI-001", "UCO-AL-001", "UCO-CM-001",
      "UCO-DP-001", "UCO-DP-002", "UCO-IR-001", "UCO-VM-001", "UCO-AT-001",
    ],
    minimumScore: 80,
    description: "SOC 2 Type II — required by many commercial and federal prime contractors",
  },
};

// Control ID → human-readable name
const CONTROL_NAMES: Record<string, string> = {
  "UCO-AC-001": "Access Control Policy",
  "UCO-AC-002": "Privileged Account Management",
  "UCO-AC-003": "Least Privilege Enforcement",
  "UCO-AI-001": "MFA Enforcement",
  "UCO-AI-002": "Identity Provider Configuration",
  "UCO-AL-001": "Audit Logging",
  "UCO-AL-002": "Log Retention",
  "UCO-CM-001": "Change Management",
  "UCO-CM-002": "Branch Protection",
  "UCO-CM-003": "Configuration Baseline",
  "UCO-DP-001": "Data Encryption at Rest",
  "UCO-DP-002": "Data Encryption in Transit",
  "UCO-DP-003": "TLS/Certificate Management",
  "UCO-IR-001": "Incident Response Plan",
  "UCO-IR-002": "Incident Response Testing",
  "UCO-NS-001": "Network Segmentation",
  "UCO-NS-002": "Firewall / WAF",
  "UCO-VM-001": "Vulnerability Management",
  "UCO-VM-002": "Patch Management",
  "UCO-AT-001": "Security Awareness Training",
};

export interface C2SOpportunity {
  opportunityId: string;
  title: string;
  agency?: string;
  value?: number;
  naicsCode?: string;
  setAside?: string;
  type?: string; // PRESOL, SOLICIT, AWARD, etc.
  requirements?: string[]; // e.g. ["CMMC_L2", "FEDRAMP_MODERATE"]
  responseDeadline?: Date;
}

export interface OpportunityComplianceGap {
  opportunityId: string;
  opportunityTitle: string;
  agency?: string;
  value?: number;
  requirements: string[];
  currentReadiness: number; // 0-100
  minimumRequired: number;
  isEligible: boolean;
  gapScore: number; // minimumRequired - currentReadiness (negative = surplus)
  missingControls: Array<{ id: string; name: string; currentStatus: string }>;
  passingRequiredControls: Array<{ id: string; name: string }>;
  requiredFrameworks: string[];
  hasRequiredFrameworks: boolean;
  estimatedRemediationDays: number;
  actionItems: string[];
}

export interface OpportunityGapReport {
  orgId: number;
  generatedAt: Date;
  totalOpportunities: number;
  eligibleOpportunities: number;
  opportunities: OpportunityComplianceGap[];
  overallReadinessScore: number;
  topGaps: Array<{ controlId: string; controlName: string; failingOpportunities: number }>;
}

@Injectable()
export class C2SIntelOpportunityGapService {
  private readonly logger = new Logger(C2SIntelOpportunityGapService.name);

  /**
   * Analyze compliance gaps for a set of C2S Intel opportunities.
   * Called when the user imports or views opportunities from C2S Intel on the EnterpriseComply dashboard.
   *
   * For each opportunity, determines what frameworks/controls are required,
   * compares against the org's current compliance posture, and returns a prioritized
   * gap analysis with specific action items.
   */
  async analyzeOpportunityGaps(
    orgId: number,
    opportunities: C2SOpportunity[],
  ): Promise<OpportunityGapReport> {
    this.logger.log(`[c2s-gap] analyzeOpportunityGaps org=${orgId} opportunities=${opportunities.length}`);

    // Get org's current control statuses
    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const controlStatusMap = new Map(controlResults.map(r => [r.ucoControlId, r.status]));

    // Get org's active frameworks
    const activeFrameworks = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    const activeFrameworkKeys = new Set(activeFrameworks.map(f => f.frameworkKey.toLowerCase()));

    // Analyze each opportunity
    const opportunityGaps: OpportunityComplianceGap[] = [];

    for (const opp of opportunities) {
      const gap = this.analyzeOpportunity(opp, controlStatusMap, activeFrameworkKeys);
      opportunityGaps.push(gap);
    }

    // Sort: eligible first (by value desc), then by gap score ascending (closest to eligible first)
    opportunityGaps.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return a.gapScore - b.gapScore;
    });

    // Find top gaps across all opportunities
    const gapControlCounts = new Map<string, number>();
    for (const opp of opportunityGaps) {
      for (const c of opp.missingControls) {
        gapControlCounts.set(c.id, (gapControlCounts.get(c.id) ?? 0) + 1);
      }
    }
    const topGaps = [...gapControlCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([controlId, count]) => ({
        controlId,
        controlName: CONTROL_NAMES[controlId] ?? controlId,
        failingOpportunities: count,
      }));

    // Overall readiness = average of all opportunity readiness scores
    const overallReadiness = opportunityGaps.length > 0
      ? Math.round(opportunityGaps.reduce((sum, o) => sum + o.currentReadiness, 0) / opportunityGaps.length)
      : 0;

    return {
      orgId,
      generatedAt: new Date(),
      totalOpportunities: opportunities.length,
      eligibleOpportunities: opportunityGaps.filter(o => o.isEligible).length,
      opportunities: opportunityGaps,
      overallReadinessScore: overallReadiness,
      topGaps,
    };
  }

  private analyzeOpportunity(
    opp: C2SOpportunity,
    controlStatusMap: Map<string, string>,
    activeFrameworkKeys: Set<string>,
  ): OpportunityComplianceGap {
    // Detect requirements from opportunity metadata if not explicitly provided
    const requirements = opp.requirements?.length
      ? opp.requirements
      : this.detectRequirements(opp);

    // Collect all required controls across all requirements
    const allRequiredControlIds = new Set<string>();
    const allRequiredFrameworks = new Set<string>();
    let minimumRequired = 0;

    for (const req of requirements) {
      const spec = FRAMEWORK_REQUIREMENTS[req];
      if (!spec) continue;
      spec.requiredControlIds.forEach(id => allRequiredControlIds.add(id));
      spec.frameworkKeys.forEach(fk => allRequiredFrameworks.add(fk));
      minimumRequired = Math.max(minimumRequired, spec.minimumScore);
    }

    if (allRequiredControlIds.size === 0) {
      // No known requirements detected — return baseline
      return {
        opportunityId: opp.opportunityId,
        opportunityTitle: opp.title,
        agency: opp.agency,
        value: opp.value,
        requirements: [],
        currentReadiness: 100,
        minimumRequired: 0,
        isEligible: true,
        gapScore: 0,
        missingControls: [],
        passingRequiredControls: [],
        requiredFrameworks: [],
        hasRequiredFrameworks: true,
        estimatedRemediationDays: 0,
        actionItems: [],
      };
    }

    // Evaluate controls
    const missingControls: Array<{ id: string; name: string; currentStatus: string }> = [];
    const passingRequiredControls: Array<{ id: string; name: string }> = [];

    for (const controlId of allRequiredControlIds) {
      const status = controlStatusMap.get(controlId) ?? "not_tested";
      if (status === "passing" || status === "compliant") {
        passingRequiredControls.push({ id: controlId, name: CONTROL_NAMES[controlId] ?? controlId });
      } else {
        missingControls.push({
          id: controlId,
          name: CONTROL_NAMES[controlId] ?? controlId,
          currentStatus: status,
        });
      }
    }

    const totalRequired = allRequiredControlIds.size;
    const passing = passingRequiredControls.length;
    const currentReadiness = totalRequired > 0 ? Math.round((passing / totalRequired) * 100) : 100;
    const gapScore = minimumRequired - currentReadiness;
    const isEligible = currentReadiness >= minimumRequired;

    // Check framework eligibility
    const requiredFrameworks = [...allRequiredFrameworks];
    const hasRequiredFrameworks = requiredFrameworks.every(fk =>
      activeFrameworkKeys.has(fk.toLowerCase())
    );

    // Estimate remediation time: ~3 days per failing control (implementation + test)
    const estimatedRemediationDays = missingControls.length * 3;

    // Build action items
    const actionItems: string[] = [];
    if (!hasRequiredFrameworks) {
      const missingFw = requiredFrameworks.filter(fk => !activeFrameworkKeys.has(fk.toLowerCase()));
      actionItems.push(`Add required compliance framework${missingFw.length > 1 ? "s" : ""}: ${missingFw.join(", ")} to your workspace`);
    }
    if (missingControls.length > 0) {
      const prioritized = missingControls.slice(0, 3);
      for (const c of prioritized) {
        actionItems.push(`Remediate ${c.id} (${c.name}) — currently ${c.currentStatus}`);
      }
      if (missingControls.length > 3) {
        actionItems.push(`+${missingControls.length - 3} more controls require attention`);
      }
    }
    if (gapScore > 0 && gapScore <= 10) {
      actionItems.push(`You are ${gapScore} points away from meeting the minimum requirement of ${minimumRequired}%`);
    }

    return {
      opportunityId: opp.opportunityId,
      opportunityTitle: opp.title,
      agency: opp.agency,
      value: opp.value,
      requirements,
      currentReadiness,
      minimumRequired,
      isEligible,
      gapScore,
      missingControls,
      passingRequiredControls,
      requiredFrameworks,
      hasRequiredFrameworks,
      estimatedRemediationDays,
      actionItems,
    };
  }

  /** Auto-detect compliance requirements from opportunity metadata */
  private detectRequirements(opp: C2SOpportunity): string[] {
    const requirements: string[] = [];
    const text = [`${opp.title}`, opp.setAside ?? "", opp.type ?? ""].join(" ").toLowerCase();

    // CMMC detection
    if (text.includes("cmmc level 3") || text.includes("cmmc l3")) requirements.push("CMMC_L3");
    else if (text.includes("cmmc level 2") || text.includes("cmmc l2") || text.includes("cui")) requirements.push("CMMC_L2");
    else if (text.includes("cmmc") || text.includes("dfars") || text.includes("fci")) requirements.push("CMMC_L1");

    // FedRAMP detection
    if (text.includes("fedramp high")) requirements.push("FEDRAMP_HIGH");
    else if (text.includes("fedramp moderate")) requirements.push("FEDRAMP_MODERATE");
    else if (text.includes("fedramp")) requirements.push("FEDRAMP_LI_SAAS");

    // ITAR detection
    if (text.includes("itar") || text.includes("ear ") || text.includes("export control")) requirements.push("ITAR");

    // SOC 2 detection
    if (text.includes("soc 2") || text.includes("soc2")) requirements.push("SOC2_TYPE2");

    // If it's a DoD contract with no specific requirement detected, default to CMMC_L1
    if (requirements.length === 0) {
      const agencies = ["department of defense", "dod", "army", "navy", "air force", "marines", "darpa", "dla", "disa", "dtra"];
      if (agencies.some(a => text.includes(a))) requirements.push("CMMC_L1");
    }

    return requirements;
  }

  /** Get framework requirement details — used by the frontend for tooltips/education */
  getFrameworkRequirements() {
    return Object.entries(FRAMEWORK_REQUIREMENTS).map(([key, spec]) => ({
      key,
      ...spec,
      controlCount: spec.requiredControlIds.length,
    }));
  }
}
