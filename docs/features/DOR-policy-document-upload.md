# Definition of Ready - customer-uploaded policy documents

Owner request, verbatim: "I want the ability for users to upload custom developed policies."

## The gap, measured

At commit 53246df the Policies module could hold a policy only as Markdown that
the platform itself generated. Measured on the repository:

- `artifacts/api-server/policy-templates/` contains the platform's own templates.
- `org_policies.content` is a `text` column, written by `createPolicy` and
  `updatePolicy` from a request body.
- `Policies.tsx` contained no occurrence of "upload" or "file".
- No multipart handler, no object storage client in use, and no `documents`
  table anywhere in `lib/db/src/schema/`.

So an organisation that had already written its policies - which is every
organisation that has been through an audit once - had nowhere to put them. The
Policies page described the templates on offer rather than the policies the
organisation operates under. An auditor asks for the second one.

## Acceptance criteria

1. A `compliance_manager` or above can upload a PDF, .docx, .doc, .odt, .rtf,
   .md or .txt document, either as a new policy or as a new version of one that
   already exists.
2. HTML, SVG, XHTML and executable formats are refused, and the refusal names
   the reason.
3. A file whose bytes do not match its extension is refused. A .pdf carrying ZIP
   bytes is the canonical case.
4. A .md or .txt file containing `<script>`, `<iframe>`, `<svg>` or an HTML
   doctype is refused.
5. Uploads are capped at 10 MB, enforced on the encoded length before the
   payload is decoded, and the ceiling is raised for that one route rather than
   globally.
6. Documents are served back only as attachments, with the Content-Type this
   platform derived from the bytes, `X-Content-Type-Options: nosniff`, and a
   sandbox CSP. Never inline.
7. No response other than the download route carries document bytes. The
   allow-list in `POLICY_DOCUMENT_SUMMARY_FIELDS` is the mechanism.
8. Every read is keyed on `org_id` as well as on the row id. A document belonging
   to another tenant reads as absent, not as forbidden.
9. Uploading a new version supersedes the previous one rather than overwriting
   it, and the database refuses two rows both claiming to be current.
10. A new upload with no existing policy creates the policy as a **draft**.
    Uploading a file is not the same act as adopting it.
11. Upload and download are both written to the audit log with filename, size,
    version and sha256 - and never with the bytes.
12. The UI states, from the API rather than from a hardcoded string, which
    formats are accepted, the size ceiling, and that documents are not scanned
    for malware.

## Blast radius

- `org_policies` gains two nullable columns. Every existing reader is unaffected;
  a null `source_type` is reported as null rather than guessed at.
- `org_policy_documents` is new. Nothing reads it yet except the new endpoints.
- `main.ts` gains one middleware, scoped by method and path.
- `StartupService` gains one migration call, and that one is **fatal** on
  failure. See below.
- No existing endpoint changes shape except `GET /orgs/:id/policies`, which gains
  three additive fields: `sourceType`, `currentDocument`, `documentCount`.

## Why the migration is fatal when the drift ledger migration is not

They sit next to each other in `onApplicationBootstrap` and are treated
differently on purpose. A missing `posture_drift_observations` table costs a
chart. A missing `org_policy_documents` table means the upload endpoint accepts a
document, fails to store it, and the customer believes their signed policy is in
the platform when it is not. Refusing to serve traffic is the better failure.

## Rollback plan

`scripts/rollback-policy-documents.cjs`, committed before the forward migration
and exercised as a dry run in CI.

The reverse is one `DROP TABLE` and two `DROP COLUMN`s. It is destructive in a
way that has to be stated rather than assumed: `org_policy_documents` holds the
only copy of every uploaded document. There is no bucket behind it and nothing to
re-derive it from. The dry run prints the document count and the stored byte
total first, so the number is seen before the decision rather than after.

Export before confirming if the content still matters.

## Why bytes live in Postgres

The platform has no object store, no lifecycle policy and no signed-URL story.
Adding all three in order to ship an upload would put customer policy documents
somewhere with weaker access control than the row that points at them, and would
add a second security boundary to review rather than one.

A capped 10 MB base64 payload in a TOASTed `TEXT` column inherits the tenancy,
backup, audit and - once Phase 2 enforcement is flipped - row-level-security
guarantees the rest of the data already has. base64 costs about a third in stored
size before TOAST compression. That is the price of not standing up a second
boundary, and it is the right trade at this document volume.

If volume ever makes it the wrong trade, `sha256` is the column an externalising
migration would key on.

## Explicitly out of scope

Stated so that absence is a decision rather than an oversight.

- **Malware scanning.** There is no scanner in the platform. Not pretended
  otherwise: `getUploadConstraints` returns `malwareScanning: false` and the UI
  shows it. Documents always leave as attachments, never rendered in place.
- **Text extraction, OCR, or control mapping from document contents.** A policy
  document is stored and served; nothing reads inside it. Mapping an uploaded
  policy to controls stays a manual act.
- **Acknowledgement flow changes.** Uploaded policies use the existing
  acknowledgement machinery unchanged, which is why an upload lands as a draft.
- **Deleting a document.** Versions supersede; nothing is removed. Permanent
  deletion of customer compliance artefacts is not a feature this PR adds.
- **e-signature or approval workflow.** `status` on the policy already carries
  draft/published; no separate approval chain is introduced.
- **Contract half of the migration.** `source_type` stays nullable. Making it
  `NOT NULL` belongs in a later change, once every writer sets it.

## Verification

- `scripts/policy-upload.test.ts` in CI, against the blank database, including
  an attempted second `current` row to prove the partial unique index exists.
- `scripts/rollback-policy-documents.cjs --dry-run` in CI.
- `verify-schema.mjs` now expects `org_policy_documents`.
- Live, after deploy: upload a document, confirm the row, confirm the download
  headers, confirm no response other than the download carries `contentBase64`.
