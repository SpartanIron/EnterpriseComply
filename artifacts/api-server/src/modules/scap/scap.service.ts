import { Injectable } from "@nestjs/common";
import { db } from "@workspace/db";
import { orgStigChecklistsTable, orgStigFindingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// SCAP/XCCDF Import Service
//
// Parses XCCDF result XML files produced by SCAP-compliant scanners such as
// SCAP Compliance Checker (SCC) and OpenSCAP.  The service uses a lightweight
// hand-rolled XML parser that works without fast-xml-parser in the dependency
// tree.  When fast-xml-parser is added via pnpm, this service can be upgraded
// to use it for more robust schema handling.
//
// XCCDF result structure targeted:
//   <TestResult>
//     <rule-result idref="...">
//       <result>pass|fail|notapplicable|notchecked|error</result>
//     </rule-result>
//     ...
//   </TestResult>
// ---------------------------------------------------------------------------

type XccdfStatus = "pass" | "fail" | "notapplicable" | "notchecked" | "error" | "unknown";

export interface ParsedFinding {
  vulnId: string;
  title: string;
  status: "open" | "not_a_finding" | "not_applicable" | "not_reviewed";
  severity: "high" | "medium" | "low";
  description: string;
  fixText: string;
  rawResult: string;
}

export interface ParseResult {
  checklistTitle: string;
  hostname: string;
  benchmarkId: string;
  startTime: string;
  findings: ParsedFinding[];
  summary: {
    total: number;
    open: number;
    notAFinding: number;
    notApplicable: number;
    notReviewed: number;
  };
}

function mapXccdfStatus(result: XccdfStatus): ParsedFinding["status"] {
  switch (result) {
    case "pass":          return "not_a_finding";
    case "fail":          return "open";
    case "notapplicable": return "not_applicable";
    case "notchecked":    return "not_reviewed";
    default:              return "not_reviewed";
  }
}

function extractTagValue(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1]!.trim() : "";
}

function extractAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}="([^"]*?)"`);
  const m = tag.match(re);
  return m ? m[1]! : "";
}

function inferSeverity(vulnId: string): ParsedFinding["severity"] {
  const lower = vulnId.toLowerCase();
  // SCC/DISA STIG CAT levels are sometimes encoded in the rule ID
  if (lower.includes("cat_1") || lower.includes("cat1") || lower.includes("high")) return "high";
  if (lower.includes("cat_3") || lower.includes("cat3") || lower.includes("low"))  return "low";
  return "medium";
}

export function parseXccdf(xmlContent: string): ParseResult {
  // Extract TestResult block
  const testResultMatch = xmlContent.match(/<TestResult[^>]*>([sS]*?)</TestResult>/i);
  const testResultBlock = testResultMatch ? testResultMatch[1]! : xmlContent;

  // Benchmark title
  const checklistTitle =
    extractTagValue(xmlContent, "title") ||
    extractAttr(xmlContent.match(/<Benchmark[^>]*>/i)?.[0] ?? "", "id") ||
    "Imported SCAP Benchmark";

  const hostname = extractTagValue(testResultBlock, "target") || "unknown-host";
  const benchmarkId = extractAttr(xmlContent.match(/<Benchmark[^>]*>/i)?.[0] ?? "", "id") || "";
  const startTime = extractAttr(testResultBlock.match(/<TestResult[^>]*>/i)?.[0] ?? "", "start-time") || new Date().toISOString();

  // Parse rule-result blocks
  const ruleResultBlocks = testResultBlock.match(/<rule-result[sS]*?</rule-result>/gi) ?? [];

  const findings: ParsedFinding[] = ruleResultBlocks.map((block) => {
    const idref = extractAttr(block.match(/<rule-result[^>]*>/i)?.[0] ?? "", "idref");
    const rawResult = (extractTagValue(block, "result") || "unknown").toLowerCase() as XccdfStatus;
    const title = extractTagValue(block, "title") || idref;
    const description = extractTagValue(block, "description") || "";
    const fixText = extractTagValue(block, "fixtext") || extractTagValue(block, "fix") || "";

    return {
      vulnId:      idref,
      title:       title || idref,
      status:      mapXccdfStatus(rawResult),
      severity:    inferSeverity(idref),
      description,
      fixText,
      rawResult,
    };
  });

  const open          = findings.filter((f) => f.status === "open").length;
  const notAFinding   = findings.filter((f) => f.status === "not_a_finding").length;
  const notApplicable = findings.filter((f) => f.status === "not_applicable").length;
  const notReviewed   = findings.filter((f) => f.status === "not_reviewed").length;

  return {
    checklistTitle,
    hostname,
    benchmarkId,
    startTime,
    findings,
    summary: { total: findings.length, open, notAFinding, notApplicable, notReviewed },
  };
}

@Injectable()
export class ScapService {
  // Parse XML content and return structured result without persisting
  parseXccdfContent(xmlContent: string): ParseResult {
    return parseXccdf(xmlContent);
  }

  // Parse and persist: creates a new STIG checklist + bulk-insert findings
  async importXccdf(orgId: number, xmlContent: string): Promise<{ checklistId: number; summary: ParseResult["summary"] }> {
    const parsed = parseXccdf(xmlContent);

    // Create the checklist record
    const [checklist] = await db
      .insert(orgStigChecklistsTable)
      .values({
        orgId,
        title:    parsed.checklistTitle,
        host:     parsed.hostname,
        source:   "xccdf_import",
        importedAt: new Date(),
      } as any)
      .returning();

    if (!checklist) throw new Error("Failed to create STIG checklist.");

    // Bulk insert findings
    if (parsed.findings.length > 0) {
      const rows = parsed.findings.map((f) => ({
        orgId,
        checklistId: checklist.id,
        vulnId:      f.vulnId,
        title:       f.title,
        status:      f.status,
        severity:    f.severity,
        description: f.description,
        fixText:     f.fixText,
        comments:    `Imported from XCCDF. Raw scanner result: ${f.rawResult}`,
      }));
      await db.insert(orgStigFindingsTable).values(rows as any);
    }

    return { checklistId: checklist.id, summary: parsed.summary };
  }
}
