import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, ucoControlsTable, orgFrameworksTable, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

// Support both Replit AI proxy env vars and standard OpenAI env vars
const openaiBaseURL =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
  process.env.OPENAI_BASE_URL;
const openaiApiKey =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "placeholder";

const openai = new OpenAI({
  ...(openaiBaseURL ? { baseURL: openaiBaseURL } : {}),
  apiKey: openaiApiKey,
});

@Injectable()
export class GapAnalysisService {
  async analyze(orgId: number) {
    const results = await db
      .select()
      .from(orgControlResultsTable)
      .where(eq(orgControlResultsTable.orgId, orgId));

    const controls = await db.select().from(ucoControlsTable);
    const frameworks = await db
      .select()
      .from(orgFrameworksTable)
      .where(and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)));

    const failing = results.filter(r => r.status === "failing");
    const notTested = results.filter(r => r.status === "not_tested");

    if (frameworks.length === 0) {
      return { items: [], summary: "No active frameworks. Add a compliance framework to get your gap analysis." };
    }

    const controlMap = new Map(controls.map(c => [c.controlId, c]));

    const failingDetails = failing.map(r => {
      const ctrl = controlMap.get(r.ucoControlId);
      return { controlId: r.ucoControlId, name: ctrl?.name ?? r.ucoControlId, domain: ctrl?.domain ?? "Unknown", remediationGuidance: ctrl?.remediationGuidance ?? "", failureReason: r.failureReason ?? "", automationLevel: ctrl?.automationLevel ?? "manual" };
    });

    const notTestedDetails = notTested.slice(0, 15).map(r => {
      const ctrl = controlMap.get(r.ucoControlId);
      return { controlId: r.ucoControlId, name: ctrl?.name ?? r.ucoControlId, domain: ctrl?.domain ?? "Unknown" };
    });

    const frameworkNames = frameworks.map(f => f.name).join(", ");
    const total = results.length;
    const passing = results.filter(r => r.status === "passing").length;
    const score = total > 0 ? Math.round((passing / total) * 100) : 0;

    const prompt = `You are a senior GRC (Governance, Risk, and Compliance) analyst. Analyze the following compliance posture and produce a prioritized remediation roadmap.

Organization compliance score: ${score}%
Active frameworks: ${frameworkNames}
Total controls: ${total}, Passing: ${passing}, Failing: ${failing.length}, Not tested: ${notTested.length}

Failing controls (${failingDetails.length}):
${failingDetails.map(c => `- ${c.controlId}: ${c.name} (Domain: ${c.domain}) ${c.failureReason ? `| Reason: ${c.failureReason}` : ""} ${c.remediationGuidance ? `| Guidance: ${c.remediationGuidance}` : ""}`).join("\n")}

Not yet tested controls (showing first ${notTestedDetails.length}):
${notTestedDetails.map(c => `- ${c.controlId}: ${c.name} (Domain: ${c.domain})`).join("\n")}

Produce a JSON remediation roadmap with this exact structure:
{
  "executiveSummary": "2-3 sentence executive summary of the compliance posture and top priorities",
  "overallRisk": "critical|high|medium|low",
  "estimatedTimeToCompliance": "e.g. 6-8 weeks",
  "items": [
    {
      "rank": 1,
      "controlId": "UCO-XX-XXX",
      "controlName": "Control name",
      "domain": "Domain name",
      "priority": "critical|high|medium|low",
      "effort": "low|medium|high",
      "effortDays": 3,
      "impact": "Brief description of what fixing this achieves",
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "frameworksBenefited": ["SOC 2", "FedRAMP"],
      "quickWin": true
    }
  ],
  "quickWins": ["Brief description of easiest wins to tackle first"],
  "longtermActions": ["Structural changes needed for sustained compliance"]
}

Rank items by: (1) business risk, (2) effort-to-impact ratio (quick wins first), (3) number of frameworks benefited. Include all failing controls plus the top 3 not-tested controls that represent highest risk. Respond with ONLY valid JSON, no markdown.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        score,
        total,
        passing,
        failing: failing.length,
        notTested: notTested.length,
        frameworks: frameworkNames,
        ...parsed,
      };
    } catch (err: any) {
      // Fallback if AI unavailable
      const fallback = failingDetails.map((c, i) => ({
        rank: i + 1,
        controlId: c.controlId,
        controlName: c.name,
        domain: c.domain,
        priority: i < 3 ? "high" : "medium",
        effort: c.automationLevel === "full" ? "low" : c.automationLevel === "partial" ? "medium" : "high",
        effortDays: c.automationLevel === "full" ? 1 : c.automationLevel === "partial" ? 5 : 10,
        impact: c.remediationGuidance || `Remediating ${c.name} will improve your compliance posture and satisfy framework requirements.`,
        actionSteps: ["Review current control implementation", "Implement required changes", "Collect and upload evidence", "Mark control as passing"],
        frameworksBenefited: frameworks.map(f => f.shortName),
        quickWin: c.automationLevel !== "manual",
      }));
      return {
        score, total, passing, failing: failing.length, notTested: notTested.length,
        frameworks: frameworkNames,
        executiveSummary: `Your organization is at ${score}% compliance across ${frameworks.length} framework${frameworks.length !== 1 ? "s" : ""}. ${failing.length} controls are currently failing and require immediate attention.`,
        overallRisk: score < 40 ? "critical" : score < 60 ? "high" : score < 75 ? "medium" : "low",
        estimatedTimeToCompliance: `${failing.length * 2}-${failing.length * 3} weeks`,
        items: fallback,
        quickWins: ["Start with automated controls - they require no manual work"],
        longtermActions: ["Establish a continuous monitoring program", "Implement automated evidence collection"],
      };
    }
  }
}
