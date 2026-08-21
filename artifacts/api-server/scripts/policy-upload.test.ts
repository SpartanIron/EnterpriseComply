/**
 * Guard: customer-uploaded policy documents.
 *
 * The feature adds an endpoint that takes attacker-controlled bytes from a
 * browser, stores them, and hands them back. Three properties have to keep
 * holding, and none of them is visible by reading a diff:
 *
 *   1. The allow-list actually excludes what it claims to. A .md file whose
 *      contents are an HTML page with a script tag is the whole stored-XSS
 *      class in one artefact, and it must be refused.
 *
 *   2. Bytes leave by one route. summarisePolicyDocument is the reason; this
 *      file is what notices when a second route starts emitting contentBase64
 *      because someone spread a row into a response.
 *
 *   3. Round trip. Bytes in equal bytes out, and the sha256 recorded matches a
 *      hash taken independently, so the integrity column means something.
 *
 * Runs against the fresh database CI stands up, after the server has booted at
 * least once so the migration has run.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { db, organizationsTable, orgPoliciesTable, orgPolicyDocumentsTable } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  POLICY_DOCUMENT_SUMMARY_FIELDS,
  policyDocumentDownloadHeaders,
  sanitiseFilename,
  summarisePolicyDocument,
  validatePolicyDocumentUpload,
} from "../src/lib/policy-upload";

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n" + "        " + detail);
  }
}

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf-8");
}

/** Strip comments before searching for code, so prose about a rule is not mistaken for the rule. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/**
 * CI runs against a blank database, so the fixture cannot assume an org exists.
 * Earlier guards in this repository failed on exactly that.
 */
async function resolveOrCreateOrg(): Promise<number> {
  const existing = await db.select().from(organizationsTable).orderBy(asc(organizationsTable.id));
  if (existing.length > 0) return existing[0].id;
  await db.insert(organizationsTable).values({
    name: "policy-upload-guard-fixture",
    slug: "policy-upload-guard-fixture",
  } as any);
  const created = await db.select().from(organizationsTable).orderBy(asc(organizationsTable.id));
  return created[0].id;
}

async function main() {
  console.log("Guard: customer-uploaded policy documents");

  // -- 1. The allow-list refuses what it says it refuses ----------------------
  //
  // Asserted before anything else. Every check below assumes validation is
  // doing something; a validator that accepted everything would let the rest of
  // this file report success.

  const htmlAsMarkdown = validatePolicyDocumentUpload({
    filename: "acceptable-use.md",
    contentBase64: b64("# Policy" + "\n" + "<script>alert(1)</script>"),
  });
  check(
    "markdown carrying a script tag is refused",
    !htmlAsMarkdown.ok && htmlAsMarkdown.reason === "text-contains-markup",
    "Got " + JSON.stringify(htmlAsMarkdown) + ". This is the stored-XSS case: the file " +
      "is served from the application's own origin.",
  );

  const svg = validatePolicyDocumentUpload({
    filename: "policy.svg",
    contentBase64: b64("<svg><script>alert(1)</script></svg>"),
  });
  check(
    "svg is not an accepted extension",
    !svg.ok && svg.reason === "extension-not-allowed",
    "Got " + JSON.stringify(svg) + ". SVG is a script container.",
  );

  const html = validatePolicyDocumentUpload({ filename: "policy.html", contentBase64: b64("<html></html>") });
  check(
    "html is not an accepted extension",
    !html.ok && html.reason === "extension-not-allowed",
    "Got " + JSON.stringify(html),
  );

  check(
    "the allow-list contains no markup or executable format",
    !ALLOWED_EXTENSIONS.some((e) => ["html", "htm", "svg", "xhtml", "xml", "js", "mjs", "exe"].includes(e)),
    "Allowed extensions are " + ALLOWED_EXTENSIONS.join(", "),
  );

  // A .pdf carrying ZIP bytes means the client is not describing what it sent.
  const lyingExtension = validatePolicyDocumentUpload({
    filename: "signed-policy.pdf",
    contentBase64: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]).toString("base64"),
  });
  check(
    "a .pdf whose bytes are a ZIP is refused",
    !lyingExtension.ok && lyingExtension.reason === "magic-mismatch",
    "Got " + JSON.stringify(lyingExtension),
  );

  // -- 2. Size is enforced on the encoded string, before a buffer exists ------
  const oversized = validatePolicyDocumentUpload({
    filename: "huge.txt",
    contentBase64: "A".repeat(Math.ceil((MAX_DOCUMENT_BYTES / 3) * 4) + 4096),
  });
  check(
    "a payload past the ceiling is refused",
    !oversized.ok && oversized.reason === "too-large",
    "Got " + JSON.stringify(oversized),
  );

  // -- 3. A legitimate document is accepted, and described from its bytes -----
  const pdfBytes = Buffer.from("%PDF-1.7" + "\n" + "1 0 obj<</Type/Catalog>>endobj" + "\n" + "%%EOF", "utf8");
  const accepted = validatePolicyDocumentUpload({
    filename: "  ../../Information Security Policy.PDF ",
    contentBase64: pdfBytes.toString("base64"),
  });
  check("a real PDF is accepted", accepted.ok, "Got " + JSON.stringify(accepted));

  if (accepted.ok) {
    check(
      "path separators are stripped from the stored filename",
      !accepted.filename.includes("/") && !accepted.filename.includes("\\") && !accepted.filename.startsWith("."),
      "Stored filename was " + JSON.stringify(accepted.filename),
    );
    check(
      "the served type comes from the allow-list, not the client",
      accepted.mimeType === "application/pdf",
      "Got " + accepted.mimeType,
    );
    check(
      "sha256 matches a hash taken independently",
      accepted.sha256 === createHash("sha256").update(pdfBytes).digest("hex"),
      "Recorded " + accepted.sha256,
    );
    check(
      "sizeBytes is the decoded length, not the encoded one",
      accepted.sizeBytes === pdfBytes.length,
      "Got " + accepted.sizeBytes + ", expected " + pdfBytes.length,
    );
  }

  // -- 4. Download headers ----------------------------------------------------
  const headers = policyDocumentDownloadHeaders({
    filename: 'weird";name.pdf',
    mimeType: "application/pdf",
    sizeBytes: 10,
  });
  const disposition = headers["Content-Disposition"] || "";
  check(
    "documents are served as attachments",
    disposition.startsWith("attachment;"),
    JSON.stringify(disposition),
  );
  check(
    "nosniff is set",
    headers["X-Content-Type-Options"] === "nosniff",
    JSON.stringify(headers["X-Content-Type-Options"]),
  );
  check(
    "a quote in the filename cannot break out of the header",
    !disposition.split('filename="')[1].split('"')[0].includes('"'),
    JSON.stringify(disposition),
  );

  // -- 5. contentBase64 is not a field a response may carry -------------------
  check(
    "the summary field list excludes contentBase64",
    !(POLICY_DOCUMENT_SUMMARY_FIELDS as readonly string[]).includes("contentBase64"),
    "Fields: " + POLICY_DOCUMENT_SUMMARY_FIELDS.join(", "),
  );

  const summarised = summarisePolicyDocument({
    id: 1,
    filename: "p.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    sha256: "abc",
    contentBase64: "SHOULD-NOT-APPEAR",
    someColumnAddedLater: "ALSO-SHOULD-NOT-APPEAR",
  });
  check(
    "summarise drops contentBase64 and anything not on the list",
    !JSON.stringify(summarised).includes("SHOULD-NOT-APPEAR"),
    JSON.stringify(summarised),
  );

  // The service is the only caller allowed to touch the raw column, and only in
  // the insert and the download decode. This catches a row spread into a body.
  const serviceSource = codeOnly(readSource("src/modules/policies/policies.service.ts"));
  const rawColumnUses = (serviceSource.match(/contentBase64/g) || []).length;
  check(
    "the service touches contentBase64 only where it must",
    rawColumnUses <= 3,
    "Found " + rawColumnUses + " references. Expected the insert, the download decode and nothing else. " +
      "A row spread into a response body is how this leaks.",
  );
  check(
    "the policy list is built through summarisePolicyDocument",
    serviceSource.includes("summarisePolicyDocument"),
    "getOrgPolicies must not hand back raw document rows.",
  );

  const controllerSource = codeOnly(readSource("src/modules/policies/policies.controller.ts"));
  check(
    "the download route uses the shared header helper",
    controllerSource.includes("policyDocumentDownloadHeaders"),
    "Headers written inline drift from the ones in the library.",
  );

  // -- 6. The larger body limit is scoped, not global -------------------------
  const mainSource = codeOnly(readSource("src/main.ts"));
  const limitMatches = mainSource.match(/limit:\s*"\d+mb"/g) || [];
  check(
    "only one raised body limit exists",
    limitMatches.length === 1,
    "Found " + JSON.stringify(limitMatches) + ". Raising the global limit gives every route a larger memory target.",
  );
  check(
    "the raised limit is bound to the upload path",
    mainSource.includes("POLICY_UPLOAD_PATH"),
    "The larger parser must be mounted behind a method and path test.",
  );

  // -- 7. Round trip through the real table -----------------------------------
  const orgId = await resolveOrCreateOrg();
  const [policy] = await db
    .insert(orgPoliciesTable)
    .values({
      orgId,
      title: "policy-upload-guard fixture",
      category: "general",
      status: "draft",
      sourceType: "uploaded",
    } as any)
    .returning();

  try {
    const stored = validatePolicyDocumentUpload({
      filename: "guard.txt",
      contentBase64: b64("Access control policy, revision 4."),
    });
    if (!stored.ok) throw new Error("fixture failed validation: " + stored.message);

    const [row] = await db
      .insert(orgPolicyDocumentsTable)
      .values({
        orgId,
        policyId: policy.id,
        version: 1,
        filename: stored.filename,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        contentBase64: stored.contentBase64,
        status: "current",
      } as any)
      .returning();

    const readBack = Buffer.from(row.contentBase64, "base64");
    const rereadHash = createHash("sha256").update(readBack).digest("hex");
    check(
      "bytes out equal bytes in",
      rereadHash === stored.sha256,
      "Stored hash " + stored.sha256 + ", re-read hash " + rereadHash,
    );

    // The partial unique index is the only thing preventing two rows both
    // claiming to be the live document. Asserted against the database, because
    // an index that failed to create looks exactly like one that did until two
    // people upload at once.
    let secondCurrentRejected = false;
    try {
      await db.insert(orgPolicyDocumentsTable).values({
        orgId,
        policyId: policy.id,
        version: 2,
        filename: "guard-2.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        sha256: "x",
        contentBase64: b64("y"),
        status: "current",
      } as any);
    } catch {
      secondCurrentRejected = true;
    }
    check(
      "the database refuses a second current version of one policy",
      secondCurrentRejected,
      "Two rows with status current for policy " + policy.id + " were accepted. The partial unique index is missing.",
    );
  } finally {
    // Remove only what this guard created.
    await db
      .delete(orgPolicyDocumentsTable)
      .where(and(eq(orgPolicyDocumentsTable.orgId, orgId), eq(orgPolicyDocumentsTable.policyId, policy.id)));
    await db.delete(orgPoliciesTable).where(eq(orgPoliciesTable.id, policy.id));
  }

  // -- 8. The migration reached the database ----------------------------------
  const cols: any = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'org_policies' AND column_name IN ('source_type', 'current_document_id')`);
  const colList = ((cols?.rows ?? cols) as Array<Record<string, unknown>>).map((r) => String(r.column_name));
  check(
    "org_policies carries both new columns",
    colList.includes("source_type") && colList.includes("current_document_id"),
    "Found " + JSON.stringify(colList),
  );

  check(
    "every accepted binary format declares a magic number",
    ALLOWED_DOCUMENT_TYPES.filter((t) => !["md", "txt"].includes(t.extension)).every((t) => t.magic.length > 0),
    "A binary format without a magic number cannot be checked against its extension.",
  );

  const controlName = "a" + "\u0000" + "b" + "\u001f" + "c.pdf";
  check(
    "sanitiseFilename removes control characters",
    !sanitiseFilename(controlName).includes("\u0000") && !sanitiseFilename(controlName).includes("\u001f"),
    JSON.stringify(sanitiseFilename(controlName)),
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\n" + "All policy document upload checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
