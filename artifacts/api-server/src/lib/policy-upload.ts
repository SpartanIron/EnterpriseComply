import { createHash } from "crypto";

/**
 * Validation and safe-serving rules for customer-uploaded policy documents.
 *
 * Kept out of the service on purpose. An upload path has exactly one job that
 * matters - deciding what is allowed in and how it is allowed back out - and
 * that decision should be testable without booting Nest, reachable from the CI
 * guard, and impossible to bypass by adding a second caller later. The same
 * mistake with integration credentials (one rule, two consumers, only one of
 * them aware of it) is what lib/integration-redaction.ts exists to prevent.
 *
 * The threats this file is answering, in the order they matter:
 *
 *   Stored XSS. A policy "document" is attacker-controlled bytes served back
 *   from the application's own origin. If a customer uploads HTML or an SVG and
 *   the browser renders it inline, that is script execution with the victim's
 *   session. Answered three ways: HTML and SVG are not allowed in at all, the
 *   Content-Type served is the one this module decided rather than the one the
 *   client claimed, and everything leaves as an attachment with nosniff.
 *
 *   Extension lying. A .pdf whose bytes are a ZIP, or a .docx whose bytes are a
 *   PDF, tells you the client is not describing what it sent. Every binary type
 *   here has a magic number and it has to match the extension.
 *
 *   Resource exhaustion. The size ceiling is checked against the encoded length
 *   before anything is decoded, so an oversized payload is rejected without
 *   being materialised.
 *
 *   Path traversal. Filenames are display strings and nothing else - nothing is
 *   ever written to a filesystem - but they are echoed into a download header,
 *   so separators, control characters and the leading dot are removed anyway.
 *
 * Not answered here, and deliberately not pretended otherwise: this does not
 * scan for malware. There is no scanner in the platform. A PDF that passes
 * every check in this file can still be malicious to whoever opens it, which is
 * why documents always leave as attachments and never render in place, and why
 * the sha256 is recorded so an operator can match a stored document against an
 * external scan result after the fact.
 */

/**
 * 10 MB. Chosen against the artefact, not against a round number: signed policy
 * PDFs with a signature page and a letterhead land between 100 KB and 3 MB, and
 * the largest control-mapped policy in the platform's own template set is under
 * 40 KB. 10 MB leaves several times the observed headroom while keeping a
 * single request inside a size a JSON body parser can hold without strain.
 */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * The encoded ceiling. base64 is 4 bytes out for every 3 in, plus padding, plus
 * an allowance for line breaks a client may have inserted. Checked first so an
 * oversized upload is rejected on a string length rather than after allocating
 * the decoded buffer.
 */
export const MAX_ENCODED_CHARS = Math.ceil((MAX_DOCUMENT_BYTES / 3) * 4) + 1024;

export interface AllowedDocumentType {
  extension: string;
  mimeType: string;
  label: string;
  /** Leading bytes every file of this type starts with, as hex. Empty for text formats. */
  magic: string[];
}

/**
 * The allow-list. Adding a format here is a security decision, so the list is
 * explicit rather than derived from a mime library, and every entry names the
 * bytes it expects.
 *
 * What is missing is the point of the list: text/html, image/svg+xml,
 * application/xhtml+xml, and anything executable. A GRC policy has never needed
 * to be an HTML file, and allowing one would put attacker-controlled markup on
 * the application's origin.
 */
export const ALLOWED_DOCUMENT_TYPES: AllowedDocumentType[] = [
  { extension: "pdf",  mimeType: "application/pdf",  label: "PDF", magic: ["255044462d"] },
  {
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word (.docx)",
    // Every OOXML file is a ZIP. 504b0304 is a populated archive; the other two
    // are the empty and spanned variants, accepted so a legitimately odd writer
    // is not rejected for a reason nobody can diagnose from the error.
    magic: ["504b0304", "504b0506", "504b0708"],
  },
  {
    extension: "odt",
    mimeType: "application/vnd.oasis.opendocument.text",
    label: "OpenDocument (.odt)",
    magic: ["504b0304", "504b0506", "504b0708"],
  },
  { extension: "doc",  mimeType: "application/msword", label: "Word 97-2003 (.doc)", magic: ["d0cf11e0a1b11ae1"] },
  { extension: "rtf",  mimeType: "application/rtf",    label: "Rich Text (.rtf)",   magic: ["7b5c727466"] },
  { extension: "md",   mimeType: "text/markdown",      label: "Markdown",           magic: [] },
  { extension: "txt",  mimeType: "text/plain",         label: "Plain text",         magic: [] },
];

export const ALLOWED_EXTENSIONS = ALLOWED_DOCUMENT_TYPES.map((t) => t.extension);

/**
 * Markup that must never appear in a file we accepted as text. Serving as an
 * attachment with nosniff already stops these from executing; this is the second
 * lock, on the grounds that a header is one configuration mistake away from
 * being absent and a rejected upload is not.
 */
const TEXT_MARKUP_PATTERNS = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*svg\b/i,
  /<!\s*doctype\s+html/i,
  /<\s*html\b/i,
  /javascript\s*:/i,
];

export type UploadRejection =
  | "empty"
  | "filename-missing"
  | "extension-not-allowed"
  | "encoding-invalid"
  | "too-large"
  | "magic-mismatch"
  | "text-contains-markup"
  | "text-not-utf8";

export interface UploadAccepted {
  ok: true;
  filename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  contentBase64: string;
}

export interface UploadRejected {
  ok: false;
  reason: UploadRejection;
  message: string;
}

export type UploadResult = UploadAccepted | UploadRejected;

/**
 * Reduce a client-supplied filename to something safe to store and to echo back
 * in a Content-Disposition header.
 *
 * Nothing here is ever used as a filesystem path, so this is not the control
 * that stops path traversal - not touching the filesystem is. It is what stops
 * a header injection and a display string that lies about its own extension.
 */
export function sanitiseFilename(raw: string): string {
  const base = String(raw ?? "")
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["']/g, "")
    .trim()
    .replace(/^\.+/, "");
  const collapsed = base.replace(/\s+/g, " ");
  return collapsed.length > 180 ? collapsed.slice(0, 180) : collapsed;
}

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop()! : "";
}

export function typeForExtension(extension: string): AllowedDocumentType | undefined {
  return ALLOWED_DOCUMENT_TYPES.find((t) => t.extension === extension);
}

/** Strict base64. Rejects data: prefixes, URL-safe alphabets and stray bytes. */
function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * The single decision point. Everything a caller needs to store a document is
 * returned; everything that makes an upload unacceptable is returned as a
 * reason code rather than thrown, so the CI guard can assert on the reason and
 * the HTTP layer can map it to a message without parsing one.
 */
export function validatePolicyDocumentUpload(input: {
  filename: string;
  contentBase64: string;
}): UploadResult {
  const filename = sanitiseFilename(input.filename);
  if (!filename) {
    return { ok: false, reason: "filename-missing", message: "A filename is required." };
  }

  const extension = extensionOf(filename);
  const type = typeForExtension(extension);
  if (!type) {
    return {
      ok: false,
      reason: "extension-not-allowed",
      message:
        "Only " + ALLOWED_EXTENSIONS.join(", ") + " files are accepted. " +
        "HTML, SVG and executable formats are refused because they would run as script on this origin.",
    };
  }

  const encoded = String(input.contentBase64 ?? "").replace(/\s+/g, "");
  if (!encoded) {
    return { ok: false, reason: "empty", message: "The file was empty." };
  }

  // Length first, decode second. The ceiling has to hold before a buffer exists.
  if (encoded.length > MAX_ENCODED_CHARS) {
    return {
      ok: false,
      reason: "too-large",
      message: "Documents are limited to " + Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024)) + " MB.",
    };
  }

  if (!isStrictBase64(encoded)) {
    return { ok: false, reason: "encoding-invalid", message: "File content was not valid base64." };
  }

  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length === 0) {
    return { ok: false, reason: "empty", message: "The file was empty." };
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: "Documents are limited to " + Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024)) + " MB.",
    };
  }

  if (type.magic.length > 0) {
    const head = buffer.subarray(0, 8).toString("hex");
    const matches = type.magic.some((m) => head.startsWith(m));
    if (!matches) {
      return {
        ok: false,
        reason: "magic-mismatch",
        message:
          "The file contents do not match a ." + extension + " file. " +
          "Rename it to its real format and upload it again.",
      };
    }
  } else {
    // Text formats have no magic number, so the checks are that it really is
    // text and that it is not markup wearing a .md extension.
    const text = buffer.toString("utf8");
    if (text.includes("\u0000")) {
      return { ok: false, reason: "text-not-utf8", message: "A ." + extension + " file must be text." };
    }
    if (TEXT_MARKUP_PATTERNS.some((p) => p.test(text))) {
      return {
        ok: false,
        reason: "text-contains-markup",
        message: "Text policies cannot contain HTML or script markup. Upload a PDF or Word document instead.",
      };
    }
  }

  return {
    ok: true,
    filename,
    extension,
    // The type served later is this one, decided from the bytes and the
    // allow-list. The Content-Type the client sent is never stored and never
    // echoed, because it is the one field an attacker fully controls.
    mimeType: type.mimeType,
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    // Re-encoded rather than passed through, so what is stored is canonical
    // base64 of the bytes that were actually validated.
    contentBase64: buffer.toString("base64"),
  };
}

/**
 * Headers for serving a stored document back.
 *
 * Always an attachment, never inline. A policy PDF is opened by a person in
 * their own reader; there is no product reason to render customer-supplied
 * bytes inside the application's origin, and every reason not to.
 */
export function policyDocumentDownloadHeaders(doc: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Record<string, string> {
  const safe = sanitiseFilename(doc.filename) || "policy-document";
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return {
    "Content-Type": doc.mimeType,
    "Content-Length": String(doc.sizeBytes),
    "Content-Disposition":
      "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(safe),
    "X-Content-Type-Options": "nosniff",
    // Belt and braces for the day someone decides inline preview is a nice idea.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  };
}
