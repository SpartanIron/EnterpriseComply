import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const NIST_800_171_WEIGHTS: Record<string, number> = {
  "3.1.1": 5, "3.1.2": 5, "3.1.3": 3, "3.1.4": 3, "3.1.5": 3, "3.1.6": 1, "3.1.7": 3, "3.1.8": 1,
  "3.1.9": 1, "3.1.10": 1, "3.1.11": 1, "3.1.12": 3, "3.1.13": 3, "3.1.14": 3, "3.1.15": 1, "3.1.16": 1,
  "3.1.17": 1, "3.1.18": 1, "3.1.19": 1, "3.1.20": 1, "3.1.21": 1, "3.1.22": 1,
  "3.2.1": 5, "3.2.2": 5, "3.2.3": 1,
  "3.3.1": 5, "3.3.2": 5, "3.3.3": 1, "3.3.4": 1, "3.3.5": 1, "3.3.6": 1, "3.3.7": 1, "3.3.8": 1, "3.3.9": 1,
  "3.4.1": 3, "3.4.2": 3, "3.4.3": 1, "3.4.4": 1, "3.4.5": 1, "3.4.6": 3, "3.4.7": 3, "3.4.8": 1, "3.4.9": 1,
  "3.5.1": 5, "3.5.2": 5, "3.5.3": 5, "3.5.4": 1, "3.5.5": 1, "3.5.6": 1, "3.5.7": 1, "3.5.8": 1, "3.5.9": 1, "3.5.10": 1, "3.5.11": 1,
  "3.6.1": 5, "3.6.2": 3, "3.6.3": 1,
  "3.7.1": 5, "3.7.2": 5, "3.7.3": 1, "3.7.4": 1, "3.7.5": 1, "3.7.6": 1,
  "3.8.1": 1, "3.8.2": 1, "3.8.3": 1, "3.8.4": 1, "3.8.5": 1, "3.8.6": 1, "3.8.7": 1, "3.8.8": 1, "3.8.9": 1,
  "3.9.1": 3, "3.9.2": 5,
  "3.10.1": 5, "3.10.2": 3, "3.10.3": 1, "3.10.4": 1, "3.10.5": 1, "3.10.6": 1,
  "3.11.1": 5, "3.11.2": 3, "3.11.3": 3,
  "3.12.1": 5, "3.12.2": 3, "3.12.3": 3, "3.12.4": 1,
  "3.13.1": 5, "3.13.2": 3, "3.13.3": 1, "3.13.4": 1, "3.13.5": 3, "3.13.6": 3, "3.13.7": 1, "3.13.8": 5, "3.13.9": 1, "3.13.10": 1, "3.13.11": 5, "3.13.12": 1, "3.13.13": 1, "3.13.14": 1, "3.13.15": 1, "3.13.16": 1,
  "3.14.1": 5, "3.14.2": 5, "3.14.3": 5, "3.14.4": 3, "3.14.5": 3, "3.14.6": 5, "3.14.7": 5,
};

const TOTAL_MAX_SCORE = Object.values(NIST_800_171_WEIGHTS).reduce((a, b) => a + b, 0);

const UCO_TO_NIST_MAP: Record<string, string[]> = {
  "UCO-AI-001": ["3.5.3", "3.5.4"],
  "UCO-AI-002": ["3.5.1", "3.5.2"],
  "UCO-AI-003": ["3.5.7", "3.5.8", "3.5.9"],
  "UCO-AI-004": ["3.5.5", "3.5.6"],
  "UCO-AC-001": ["3.1.1", "3.1.2"],
  "UCO-AC-002": ["3.1.5", "3.1.6"],
  "UCO-AC-003": ["3.1.3", "3.1.4"],
  "UCO-AC-004": ["3.1.12", "3.1.13"],
  "UCO-AC-005": ["3.9.1", "3.9.2"],
  "UCO-CM-001": ["3.4.1", "3.4.2"],
  "UCO-CM-002": ["3.4.6", "3.4.7"],
  "UCO-CM-003": ["3.4.3", "3.4.4"],
  "UCO-DP-001": ["3.13.1", "3.13.2"],
  "UCO-DP-002": ["3.13.8", "3.13.11"],
  "UCO-DP-003": ["3.13.16"],
  "UCO-AL-001": ["3.3.1", "3.3.2"],
  "UCO-AL-002": ["3.3.3", "3.3.4"],
  "UCO-VM-001": ["3.14.1", "3.14.2"],
  "UCO-VM-002": ["3.14.3", "3.14.4", "3.14.5"],
  "UCO-IR-001": ["3.6.1", "3.6.2"],
  "UCO-IR-002": ["3.6.3"],
  "UCO-ST-001": ["3.2.1", "3.2.2"],
  "UCO-CP-001": ["3.7.1", "3.7.2"],
  "UCO-CP-002": ["3.7.4", "3.7.5"],
};

@Injectable()
export class SprsService {
  async calculate(orgId: number) {
    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r.status]));

    const nistScores: Record<string, { weight: number; status: "met" | "not_met" | "not_reviewed" }> = {};
    for (const [nist, weight] of Object.entries(NIST_800_171_WEIGHTS)) {
      nistScores[nist] = { weight, status: "not_reviewed" };
    }

    for (const [ucoId, nistIds] of Object.entries(UCO_TO_NIST_MAP)) {
      const status = resultMap.get(ucoId);
      for (const nistId of nistIds) {
        if (nistScores[nistId]) {
          if (status === "passing") nistScores[nistId].status = "met";
          else if (status === "failing") nistScores[nistId].status = "not_met";
        }
      }
    }

    let score = -203;
    for (const { weight, status } of Object.values(nistScores)) {
      if (status === "met") score += weight;
    }
    score = Math.min(110, score);

    const met = Object.values(nistScores).filter((s) => s.status === "met").length;
    const notMet = Object.values(nistScores).filter((s) => s.status === "not_met").length;
    const notReviewed = Object.values(nistScores).filter((s) => s.status === "not_reviewed").length;
    const totalControls = Object.keys(NIST_800_171_WEIGHTS).length;

    return {
      score,
      maxScore: 110,
      minScore: -203,
      met,
      notMet,
      notReviewed,
      totalControls,
      percentComplete: Math.round((met / totalControls) * 100),
      readinessLevel: score >= 80 ? "high" : score >= 0 ? "medium" : score >= -60 ? "low" : "critical",
      nistScores,
      industryAverage: -12,
      topGaps: Object.entries(nistScores)
        .filter(([, s]) => s.status === "not_met")
        .sort(([, a], [, b]) => b.weight - a.weight)
        .slice(0, 10)
        .map(([nist, s]) => ({ nistId: nist, weight: s.weight })),
    };
  }
}
