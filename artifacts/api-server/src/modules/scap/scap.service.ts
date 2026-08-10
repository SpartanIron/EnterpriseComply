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

/**
 * Linear, backtracking-free XCCDF tag helpers.
 *
 * SCAP/XCCDF documents are attacker-supplied uploads of arbitrary size. Scanning
 * them with patterns such as `<tag[^>]*>([\s\S]*?)</tag>` is polynomial in the
 * input length, because the engine retries the ambiguous prefix at every offset
 * (CodeQL js/polynomial-redos). Everything below uses indexOf only, so each
 * operation is O(n) with no backtracking.
 */
const TAG_NAME_BOUNDARY = new Set([" ", "\t", "\r", "\n", ">", "/"]);

/** Hard cap so a hostile document cannot make us allocate unbounded findings. */
const MAX_PARSED_BLOCKS = 50000;

interface OpenTag { open: string; start: number; end: number }
interface TagBlock { open: string; inner: string; whole: string; end: number }

function findOpenTag(xml: string, tag: string, from = 0): OpenTag | null {
  const needle = "<" + tag;
  let cursor = from;
  for (;;) {
    const i = xml.indexOf(needle, cursor);
    if (i < 0) return null;
    const boundary = xml[i + needle.length];
    if (boundary === undefined || TAG_NAME_BOUNDARY.has(boundary)) {
      const gt = xml.indexOf(">", i);
      if (gt < 0) return null;
      return { open: xml.slice(i, gt + 1), start: i, end: gt + 1 };
    }
    cursor = i + needle.length;
  }
}

function findBlock(xml: string, tag: string, from = 0): TagBlock | null {
  const openTag = findOpenTag(xml, tag, from);
  if (!openTag) return null;
  const closeIdx = xml.indexOf("</" + tag, openTag.end);
  if (closeIdx < 0) return null;
  const closeGt = xml.indexOf(">", closeIdx);
  const wholeEnd = closeGt < 0 ? xml.length : closeGt + 1;
  return {
    open: openTag.open,
    inner: xml.slice(openTag.end, closeIdx),
    whole: xml.slice(openTag.start, wholeEnd),
    end: wholeEnd,
  };
}

function findAllBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  while (out.length < MAX_PARSED_BLOCKS) {
    const block = findBlock(xml, tag, cursor);
    if (!block) break;
    out.push(block.whole);
    cursor = block.end;
  }
  return out;
}

function extractTagValue(xml: string, tag: string): string {
  const block = findBlock(xml, tag);
  return block ? block.inner.trim() : "";
}

function extractAttr(tag: string, attr: string): string {
  const needle = attr + '="';
  const at = tag.indexOf(needle);
  if (at < 0) return "";
  const start = at + needle.length;
  const end = tag.indexOf('"', start);
  return end < 0 ? "" : tag.slice(start, end);
}

function inferSeverity(vulnId: string): ParsedFinding["severity"] {
  const lower = vulnId.toLowerCase();
  if (lower.includes("cat_1") || lower.includes("cat1") || lower.includes("high")) return "high";
  if (lower.includes("cat_3") || lower.includes("cat3") || lower.includes("low"))  return "low";
  return "medium";
}

export function parseXccdf(xmlContent: string): ParseResult {
  const testResultMatch = findBlock(xmlContent, "TestResult");
  const testResultBlock = testResultMatch ? testResultMatch.inner : xmlContent;

  const checklistTitle =
    extractTagValue(xmlContent, "title") ||
    extractAttr(findOpenTag(xmlContent, "Benchmark")?.open ?? "", "id") ||
    "Imported SCAP Benchmark";

  const hostname = extractTagValue(testResultBlock, "target") || "unknown-host";
  const benchmarkId = extractAttr(findOpenTag(xmlContent, "Benchmark")?.open ?? "", "id") || "";
  const startTime = extractAttr(testResultMatch?.open ?? "", "start-time") || new Date().toISOString();

  const ruleResultBlocks = findAllBlocks(testResultBlock, "rule-result");

  const findings: ParsedFinding[] = ruleResultBlocks.map((block) => {
    const idref = extractAttr(findOpenTag(block, "rule-result")?.open ?? "", "idref");
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
  parseXccdfContent(xmlContent: string): ParseResult {
    return parseXccdf(xmlContent);
  }

  async importXccdf(orgId: number, xmlContent: string): Promise<{ checklistId: number; summary: ParseResult["summary"] }> {
    const parsed = parseXccdf(xmlContent);

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
        comments:    "Imported from XCCDF. Raw scanner result: " + f.rawResult,
      }));
      await db.insert(orgStigFindingsTable).values(rows as any);
    }

    return { checklistId: checklist.id, summary: parsed.summary };
  }
  }
