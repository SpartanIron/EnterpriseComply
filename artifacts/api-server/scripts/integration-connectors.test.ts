/**
 * Guard: real integration connectors.
 *
 * The defect this file protects against is not a bug in a function. It was a
 * product decision encoded in one line:
 *
 *     status: Math.random() > 0.15 ? "passing" : "failing"
 *
 * connectDemo() wrote that into org_control_results for every control the
 * catalogue claimed a tool covered, so a customer who pressed "Connect (Demo)"
 * on Splunk moved their compliance score with a random number generator. The
 * score, the framework coverage figures and the Board report all read those
 * rows as measurements.
 *
 * A regression here would not look like a crash. It would look like a working
 * feature. So the checks below are about absence as much as presence: no
 * fabrication in the service, no demo route in the controller, no spec that
 * claims to work without a verification request behind it, and no connector
 * whose declared secret escapes redaction.
 *
 * Nothing here makes an outbound request. Verifying a real credential needs a
 * real credential, which CI does not have and should not.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INTEGRATION_CATALOG } from "../src/modules/integrations/integrations.service";
import {
  CONNECTOR_SPECS,
  connectorSpec,
  connectorSummary,
  publicSpec,
  secretFieldKeys,
} from "../src/modules/integrations/connector-specs";
import {
  resolveTemplate,
  validateSubmittedFields,
  verifyConnector,
} from "../src/modules/integrations/connector-engine";
import { REDACTED_CONFIG_KEYS, redactConnectionCredentials } from "../src/lib/integration-redaction";

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

/**
 * Strip comments before searching for code.
 *
 * Needed here specifically: connector-specs.ts and integrations.service.ts both
 * quote the deleted Math.random() line in their headers so the next reader knows
 * what was removed and why. Prose describing a defect is not the defect. An
 * earlier guard in this repository failed on exactly that.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function main() {
  console.log("Guard: real integration connectors");

  // -- 1. The fabrication is gone from the code, not just from the UI ---------
  const serviceCode = codeOnly(readSource("src/modules/integrations/integrations.service.ts"));
  check(
    "the service contains no random number generation",
    !serviceCode.includes("Math.random"),
    "Math.random appears in integrations.service.ts outside a comment. This is how fabricated control " +
      "results came back.",
  );
  check(
    "connectDemo no longer exists",
    !/\bconnectDemo\s*\(/.test(serviceCode),
    "connectDemo is still callable.",
  );

  const controllerCode = codeOnly(readSource("src/modules/integrations/integrations.controller.ts"));
  check(
    "the demo-connect route is gone",
    !controllerCode.includes("demo-connect"),
    "A route reaching the fabrication is still registered. Deleting the method without deleting the route " +
      "would leave it one HTTP call away.",
  );
  check(
    "the credential connect route exists",
    controllerCode.includes("connect-credentials"),
    "The replacement route is missing, so the catalogue would have no way to connect at all.",
  );

  // -- 2. Every catalogue entry is accounted for ------------------------------
  const catalogKeys = INTEGRATION_CATALOG.map((c: any) => c.key);
  const missing = catalogKeys.filter((k: string) => !connectorSpec(k));
  check(
    "every catalogue entry has a spec",
    missing.length === 0,
    "No spec for: " + missing.join(", ") + ". A catalogue entry with no spec renders a button that does nothing.",
  );

  const orphans = CONNECTOR_SPECS.filter((s) => !catalogKeys.includes(s.key)).map((s) => s.key);
  check(
    "no spec describes a tool that is not in the catalogue",
    orphans.length === 0,
    "Specs with no catalogue entry: " + orphans.join(", "),
  );

  // -- 3. A spec cannot claim to work without the means to prove it -----------
  const liveWithoutVerify = CONNECTOR_SPECS.filter((s) => s.state === "live" && !s.verify).map((s) => s.key);
  check(
    "every live connector has a verification request",
    liveWithoutVerify.length === 0,
    "Live but unverifiable: " + liveWithoutVerify.join(", ") + ". This is the exact shape of the old defect: " +
      "a connector that reports success without checking anything.",
  );

  const liveWithoutFields = CONNECTOR_SPECS.filter((s) => s.state === "live" && s.fields.length === 0).map((s) => s.key);
  check(
    "every live connector asks for at least one field",
    liveWithoutFields.length === 0,
    "Live with no fields: " + liveWithoutFields.join(", "),
  );

  const liveWithoutSecret = CONNECTOR_SPECS.filter(
    (s) => s.state === "live" && !s.fields.some((f) => f.secret),
  ).map((s) => s.key);
  check(
    "every live connector has at least one secret field",
    liveWithoutSecret.length === 0,
    "Live with no secret: " + liveWithoutSecret.join(", ") + ". A connector authenticating with no secret is " +
      "either wrong or is not authenticating.",
  );

  const unavailableWithoutReason = CONNECTOR_SPECS.filter(
    (s) => s.state === "unavailable" && !(s.unavailableReason ?? "").trim(),
  ).map((s) => s.key);
  check(
    "every unavailable connector states why",
    unavailableWithoutReason.length === 0,
    "Unavailable with no reason: " + unavailableWithoutReason.join(", ") + ". The reason is shown to the " +
      "customer; without it the card says only that they cannot have it.",
  );

  // -- 4. Every placeholder resolves to something ----------------------------
  //
  // A template naming a field the spec does not declare produces an empty
  // segment in a URL or a header, which fails against the vendor in a way no
  // customer could diagnose.
  const badPlaceholders: string[] = [];
  for (const spec of CONNECTOR_SPECS) {
    const declared = new Set(spec.fields.map((f) => f.key));
    const templates: string[] = [];
    if (spec.verify) {
      templates.push(spec.verify.url, spec.verify.body ?? "", ...Object.values(spec.verify.headers ?? {}));
    }
    if (spec.grant) {
      templates.push(spec.grant.url, spec.grant.body, ...Object.values(spec.grant.headers ?? {}));
    }
    for (const template of templates) {
      for (const match of template.matchAll(/\$\{([^}]+)\}/g)) {
        const expression = match[1];
        if (expression === "accessToken") continue;
        // Each side of a basic template is a slash-joined list of
        // field-or-literal tokens, so a token that is not a field is a literal
        // by design and there is nothing to check.
        if (expression.startsWith("basic:")) continue;
        const [name, fallback] = expression.split("|");
        if (!declared.has(name) && fallback === undefined) {
          badPlaceholders.push(spec.key + ": " + expression);
        }
      }
    }
    if (spec.grant) {
      check(
        spec.key + " names the property holding its token",
        Boolean(spec.grant.tokenField),
        "grant.tokenField is empty for " + spec.key,
      );
    }
  }
  check(
    "every template placeholder resolves to a declared field",
    badPlaceholders.length === 0,
    "Unresolvable: " + badPlaceholders.join("; "),
  );

  // -- 5. Every outbound URL is https ----------------------------------------
  const nonHttps: string[] = [];
  for (const spec of CONNECTOR_SPECS) {
    for (const url of [spec.verify?.url, spec.grant?.url]) {
      if (!url) continue;
      // A templated host starts with the placeholder, and those fields are
      // validated as https at submit time by validateSubmittedFields.
      if (url.startsWith("$")) continue;
      if (!url.startsWith("https://")) nonHttps.push(spec.key + ": " + url);
    }
  }
  check("no connector calls a plaintext URL", nonHttps.length === 0, nonHttps.join("; "));

  // -- 6. Declared secrets are covered by redaction --------------------------
  const declaredSecrets = [...secretFieldKeys()];
  const unprotected = declaredSecrets.filter((k) => !REDACTED_CONFIG_KEYS.has(k));
  check(
    "every declared secret field is redacted",
    unprotected.length === 0,
    "Declared secret but not redacted: " + unprotected.join(", "),
  );

  // The five that were missing from the hand-written list while provider modules
  // in this repository were storing them. Named individually so the regression
  // is caught by name rather than by a count.
  for (const key of ["bottoken", "secretkey", "appkey", "clientsecret", "refreshtoken"]) {
    check(
      "redaction covers " + key,
      REDACTED_CONFIG_KEYS.has(key),
      key + " was absent from the hand-written list while provider modules stored it.",
    );
  }

  // Measured, not inferred: a config carrying a spec-declared secret must come
  // back without it.
  const redacted = redactConnectionCredentials({
    id: 1,
    orgId: 1,
    integrationKey: "slack",
    accessToken: "should-not-survive",
    refreshToken: null,
    config: { botToken: "xoxb-should-not-survive", teamName: "Acme" },
  } as any);
  check(
    "a spec-declared config secret is stripped from a serialised row",
    !JSON.stringify(redacted).includes("should-not-survive"),
    JSON.stringify(redacted),
  );
  check(
    "non-credential config survives redaction",
    JSON.stringify(redacted).includes("Acme"),
    "Redaction removed configuration that is not a credential, which would break the UI.",
  );

  // -- 7. The browser never receives the verification request ---------------
  const published = JSON.stringify(CONNECTOR_SPECS.map(publicSpec));
  check(
    "published specs carry no request URLs",
    !published.includes("https://api."),
    "A verification URL reached the public spec. It is not itself a secret, but publishing the exact call " +
      "the server makes with a customer's token is free reconnaissance for no product benefit.",
  );
  check(
    "published specs carry no header templates",
    !published.includes("Authorization"),
    "A header template reached the public spec.",
  );

  // -- 8. Template resolution ------------------------------------------------
  check(
    "a placeholder inside a value is not expanded again",
    resolveTemplate("https://x/" + "${a}", { a: "${b}", b: "secret" }) === "https://x/" + "${b}",
    "Single-pass substitution failed. A field able to expand into another field would let one credential " +
      "be read through another.",
  );
  check(
    "a default is used when the field is empty",
    resolveTemplate("${site|datadoghq.com}", {}) === "datadoghq.com",
    resolveTemplate("${site|datadoghq.com}", {}),
  );
  check(
    "basic templates assemble a base64 credential",
    resolveTemplate("${basic:user:pass}", { user: "a", pass: "b" }) === Buffer.from("a:b").toString("base64"),
    resolveTemplate("${basic:user:pass}", { user: "a", pass: "b" }),
  );
  const literalSide = Buffer.from(
    resolveTemplate("${basic:email/token:t}", { email: "x@y.z", t: "k" }),
    "base64",
  ).toString();
  check(
    "a literal token in a basic template stays literal",
    literalSide === "x@y.z/token:k",
    literalSide,
  );

  // -- 9. Field validation ---------------------------------------------------
  const slack = connectorSpec("slack")!;
  const injected = validateSubmittedFields(slack, { botToken: "xoxb-abc" + "\r" + "X-Evil: 1" });
  check(
    "a carriage return in a credential is refused",
    !injected.ok,
    "Header injection: credential values are interpolated into outbound request headers.",
  );

  const jira = connectorSpec("jira")!;
  const traversal = validateSubmittedFields(jira, {
    domain: "acme.atlassian.net/../../evil",
    email: "a@b.c",
    apiToken: "t",
  });
  check(
    "a path in a non-secret field is refused",
    !traversal.ok,
    "That value is interpolated into the host and path this platform calls.",
  );

  const servicenow = connectorSpec("servicenow")!;
  const plaintext = validateSubmittedFields(servicenow, {
    instanceUrl: "http://acme.service-now.com",
    username: "u",
    password: "p",
  });
  check(
    "an http URL is refused where https is required",
    !plaintext.ok,
    "A credential would be sent over a plaintext connection.",
  );

  const good = validateSubmittedFields(jira, { domain: "acme", email: "a@b.c", apiToken: "t" });
  check("a valid credential set is accepted", good.ok, JSON.stringify(good));

  const extra = validateSubmittedFields(slack, { botToken: "xoxb-abc", somethingElse: "kept" });
  check(
    "an undeclared field is not carried through",
    extra.ok && !Object.keys(extra.values).includes("somethingElse"),
    "An extra property in the request body would reach the config column, outside every rule that decides " +
      "what is a secret.",
  );

  // -- 10. An unavailable connector makes no request ------------------------
  const unavailableSpec = CONNECTOR_SPECS.find((s) => s.state === "unavailable")!;
  const outcome = await verifyConnector(unavailableSpec, {});
  check(
    "verifying an unavailable connector fails without calling out",
    !outcome.ok && outcome.stage === "none" && outcome.detail === unavailableSpec.unavailableReason,
    JSON.stringify(outcome),
  );

  // -- 11. The headline numbers are what they claim -------------------------
  const summary = connectorSummary();
  check(
    "the summary counts add up to the catalogue",
    summary.native + summary.live + summary.unavailable === summary.total &&
      summary.total === catalogKeys.length,
    JSON.stringify(summary) + " against " + catalogKeys.length + " catalogue entries.",
  );
  check(
    "the summary says what live means",
    summary.liveMeaning.includes("proved against"),
    "The number must travel with its meaning, or 37 live connectors reads as 37 tools being assessed.",
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\n" + "All connector checks passed. " + JSON.stringify(summary));
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
