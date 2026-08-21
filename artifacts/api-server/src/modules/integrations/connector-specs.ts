/**
 * Declarative connector registry.
 *
 * Why this file exists
 * -------------------------------------------------------------------------
 * The integration catalogue listed 65 tools. Seven of them had a real
 * connector. The other fifty-eight rendered a button labelled
 * "Connect (Demo)", and that button called connectDemo(), which did this:
 *
 *     status: Math.random() > 0.15 ? "passing" : "failing"
 *
 * and wrote the result into org_control_results - the same table the
 * compliance score is computed from - alongside evidence rows describing scans
 * that never ran. A customer clicking Connect on Splunk did not get a disabled
 * placeholder. They got a compliance score built partly from a random number
 * generator, and a Board report that reported it.
 *
 * That is the defect this file exists to remove. The fabrication is gone and
 * nothing replaces it: an integration is connected when a real authenticated
 * call to the vendor's own API succeeded, and it is not connected otherwise.
 *
 * What a spec is
 * -------------------------------------------------------------------------
 * A connector spec says three things: which credential fields to ask the
 * customer for, which of those fields are secret, and one request that proves
 * the credentials work. The request runs at connect time through guardedFetch,
 * so a tenant-supplied base URL cannot be aimed at the platform's own network.
 *
 * The engine understands three authentication shapes and nothing else:
 *
 *   "header"       - credentials go straight into request headers
 *   "basic"        - two fields become an HTTP Basic credential
 *   "token-grant"  - a form or JSON POST exchanges credentials for a bearer
 *                    token, which is then used for the verification call
 *
 * On what is deliberately NOT here
 * -------------------------------------------------------------------------
 * Several vendors cannot be reached with any of the three shapes above. AWS
 * needs SigV4. Google needs an RS256-signed JWT assertion. Duo, Veracode and
 * NetSuite sign every individual request. ADP requires mutual TLS.
 *
 * Those are marked "unavailable" with the reason stated in the spec and shown
 * in the UI. That is deliberate: an entry with a guessed endpoint would look
 * identical to a working one until a customer pasted real credentials into it,
 * and would then fail in a way they could not diagnose and would reasonably
 * read as their own mistake. A connector that says "not built yet, and here is
 * why" is worth more than one that lies.
 *
 * The same rule was applied to endpoints. Every URL below is either taken from
 * a provider module already in this repository or is a vendor's documented
 * identity or self endpoint. Where neither was true the entry is unavailable
 * rather than plausible.
 */

export type ConnectorState =
  /** Has a first-class connector in this codebase already. */
  | "native"
  /** Credentials can be captured and verified against the vendor by this engine. */
  | "live"
  /** Cannot be reached by this engine. The reason is in unavailableReason. */
  | "unavailable";

export type AuthShape = "header" | "basic" | "token-grant";

export interface ConnectorField {
  key: string;
  label: string;
  /** True means: encrypted at rest, never serialised to a browser, never logged. */
  secret: boolean;
  required: boolean;
  placeholder?: string;
  help?: string;
}

export interface TokenGrant {
  /** Templated with ${field} from the submitted credentials. */
  url: string;
  /** "form" sends application/x-www-form-urlencoded, "json" sends JSON. */
  encoding: "form" | "json";
  body: string;
  headers?: Record<string, string>;
  /** Property of the JSON response holding the bearer token. */
  tokenField: string;
}

export interface Verification {
  method: "GET" | "POST";
  /** Templated with ${field}, and with ${accessToken} when a grant ran first. */
  url: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
  /**
   * Some vendors answer 200 with { ok: false } for a bad credential. When set,
   * this property of the JSON body must be truthy as well as the status.
   */
  requireJsonTrue?: string;
}

export interface ConnectorSpec {
  key: string;
  state: ConnectorState;
  authShape?: AuthShape;
  fields: ConnectorField[];
  grant?: TokenGrant;
  verify?: Verification;
  /** Where the customer goes to create the credential. */
  docsUrl?: string;
  /** Required when state is "unavailable". Shown to the customer verbatim. */
  unavailableReason?: string;
  /** Honest statement of what a successful connection currently collects. */
  collects: "automated-checks" | "connection-only";
  note?: string;
}

const secret = (key: string, label: string, extra: Partial<ConnectorField> = {}): ConnectorField => ({
  key, label, secret: true, required: true, ...extra,
});
const plain = (key: string, label: string, extra: Partial<ConnectorField> = {}): ConnectorField => ({
  key, label, secret: false, required: true, ...extra,
});

/** A connector this repository already implements by hand. */
const native = (key: string): ConnectorSpec => ({
  key, state: "native", fields: [], collects: "automated-checks",
});

/** A connector this engine cannot express. The reason is the point of the entry. */
const unavailable = (key: string, unavailableReason: string): ConnectorSpec => ({
  key, state: "unavailable", fields: [], collects: "connection-only", unavailableReason,
});

export const CONNECTOR_SPECS: ConnectorSpec[] = [
  // ── Already implemented by hand in this repository ────────────────────────
  native("github"),
  native("aws"),
  native("okta"),
  native("cloudflare"),
  native("railway"),
  native("replit"),
  native("betterauth"),

  // ── Chat and collaboration ────────────────────────────────────────────────
  {
    key: "slack",
    state: "live",
    authShape: "header",
    fields: [secret("botToken", "Bot user OAuth token", { placeholder: "xoxb-...", help: "Slack app > OAuth & Permissions > Bot User OAuth Token" })],
    verify: {
      method: "GET",
      url: "https://slack.com/api/team.info",
      headers: { Authorization: "Bearer ${botToken}" },
      // Slack answers 200 with { ok: false, error: "invalid_auth" } for a bad
      // token, so status alone would accept a credential that does not work.
      requireJsonTrue: "ok",
    },
    docsUrl: "https://api.slack.com/authentication/token-types",
    collects: "connection-only",
  },
  {
    key: "zoom",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("accountId", "Account ID"),
      plain("clientId", "Client ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://zoom.us/oauth/token",
      encoding: "form",
      body: "grant_type=account_credentials&account_id=${accountId}",
      headers: { Authorization: "Basic ${basic:clientId:clientSecret}" },
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://api.zoom.us/v2/users/me",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    docsUrl: "https://developers.zoom.us/docs/internal-apps/s2s-oauth/",
    collects: "connection-only",
  },

  // ── Ticketing and change management ───────────────────────────────────────
  {
    key: "jira",
    state: "live",
    authShape: "basic",
    fields: [
      plain("domain", "Atlassian site", { placeholder: "acme", help: "The subdomain in acme.atlassian.net" }),
      plain("email", "Account email"),
      secret("apiToken", "API token"),
    ],
    verify: {
      method: "GET",
      url: "https://${domain}.atlassian.net/rest/api/3/myself",
      headers: { Authorization: "Basic ${basic:email:apiToken}" },
    },
    docsUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    collects: "connection-only",
  },
  {
    key: "servicenow",
    state: "live",
    authShape: "basic",
    fields: [
      plain("instanceUrl", "Instance URL", { placeholder: "https://acme.service-now.com" }),
      plain("username", "Integration user"),
      secret("password", "Password"),
    ],
    verify: {
      method: "GET",
      url: "${instanceUrl}/api/now/table/sys_user?sysparm_limit=1",
      headers: { Authorization: "Basic ${basic:username:password}" },
    },
    collects: "connection-only",
  },
  {
    key: "linear",
    state: "live",
    authShape: "header",
    fields: [secret("apiKey", "Personal API key", { placeholder: "lin_api_..." })],
    verify: {
      method: "POST",
      url: "https://api.linear.app/graphql",
      headers: { Authorization: "${apiKey}" },
      contentType: "application/json",
      body: "{\"query\":\"{ viewer { id } }\"}",
    },
    docsUrl: "https://linear.app/settings/api",
    collects: "connection-only",
  },
  {
    key: "pagerduty",
    state: "live",
    authShape: "header",
    fields: [secret("apiToken", "REST API token")],
    verify: {
      method: "GET",
      url: "https://api.pagerduty.com/users?limit=1",
      headers: { Authorization: "Token token=${apiToken}", Accept: "application/vnd.pagerduty+json;version=2" },
    },
    collects: "connection-only",
  },

  // ── Source control and CI ─────────────────────────────────────────────────
  {
    key: "gitlab",
    state: "live",
    authShape: "header",
    fields: [
      plain("baseUrl", "GitLab URL", { placeholder: "https://gitlab.com", required: false }),
      secret("token", "Personal or group access token", { help: "read_api scope is enough" }),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl|https://gitlab.com}/api/v4/user",
      headers: { "PRIVATE-TOKEN": "${token}" },
    },
    collects: "connection-only",
  },
  {
    key: "circleci",
    state: "live",
    authShape: "header",
    fields: [secret("token", "Personal API token")],
    verify: { method: "GET", url: "https://circleci.com/api/v2/me", headers: { "Circle-Token": "${token}" } },
    collects: "connection-only",
  },
  {
    key: "jenkins",
    state: "live",
    authShape: "basic",
    fields: [
      plain("baseUrl", "Jenkins URL", { placeholder: "https://ci.acme.com" }),
      plain("username", "Username"),
      secret("apiToken", "API token"),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl}/api/json",
      headers: { Authorization: "Basic ${basic:username:apiToken}" },
    },
    note: "A Jenkins controller on a private network is refused by the outbound SSRF guard, not by Jenkins.",
    collects: "connection-only",
  },
  {
    key: "github-actions",
    state: "unavailable",
    fields: [],
    collects: "connection-only",
    unavailableReason:
      "Not a separate integration. Workflow and secret-scanning evidence comes from the GitHub connector, " +
      "which is already available above. Connecting GitHub covers this.",
  },

  // ── Vulnerability and endpoint ────────────────────────────────────────────
  {
    key: "tenable",
    state: "live",
    authShape: "header",
    fields: [
      plain("baseUrl", "Tenable URL", { placeholder: "https://cloud.tenable.com", required: false }),
      plain("accessKey", "Access key"),
      secret("secretKey", "Secret key"),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl|https://cloud.tenable.com}/workbenches/assets?date_range=1",
      headers: { "X-ApiKeys": "accessKey=${accessKey}; secretKey=${secretKey}" },
    },
    collects: "connection-only",
  },
  {
    key: "qualys",
    state: "live",
    authShape: "basic",
    fields: [
      plain("baseUrl", "Qualys API URL", { placeholder: "https://qualysapi.qg2.apps.qualys.com" }),
      plain("username", "Username"),
      secret("password", "Password"),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl}/api/2.0/fo/report/?action=list",
      headers: { Authorization: "Basic ${basic:username:password}", "X-Requested-With": "EnterpriseComply" },
    },
    collects: "connection-only",
  },
  {
    key: "crowdstrike",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("baseUrl", "API base", { placeholder: "https://api.crowdstrike.com", required: false }),
      plain("clientId", "Client ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "${baseUrl|https://api.crowdstrike.com}/oauth2/token",
      encoding: "form",
      body: "client_id=${clientId}&client_secret=${clientSecret}",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "${baseUrl|https://api.crowdstrike.com}/policy/combined/prevention/v1?limit=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "sentinelone",
    state: "live",
    authShape: "header",
    fields: [
      plain("baseUrl", "Console URL", { placeholder: "https://acme.sentinelone.net" }),
      secret("apiToken", "API token"),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl}/web/api/v2.1/agents?limit=1",
      headers: { Authorization: "ApiToken ${apiToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "snyk",
    state: "live",
    authShape: "header",
    fields: [secret("apiToken", "API token")],
    verify: {
      method: "GET",
      url: "https://api.snyk.io/v1/user/me",
      headers: { Authorization: "token ${apiToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "wiz",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tokenUrl", "Token endpoint", { placeholder: "https://auth.app.wiz.io/oauth/token", required: false }),
      plain("apiUrl", "GraphQL endpoint", { placeholder: "https://api.us1.app.wiz.io/graphql", required: false }),
      plain("clientId", "Service account client ID"),
      secret("clientSecret", "Service account client secret"),
    ],
    grant: {
      url: "${tokenUrl|https://auth.app.wiz.io/oauth/token}",
      encoding: "form",
      body: "grant_type=client_credentials&audience=wiz-api&client_id=${clientId}&client_secret=${clientSecret}",
      tokenField: "access_token",
    },
    verify: {
      method: "POST",
      url: "${apiUrl|https://api.us1.app.wiz.io/graphql}",
      headers: { Authorization: "Bearer ${accessToken}" },
      contentType: "application/json",
      body: "{\"query\":\"{ viewer { id } }\"}",
    },
    collects: "connection-only",
  },
  {
    key: "prisma-cloud",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("apiUrl", "Console API URL", { placeholder: "https://api.prismacloud.io" }),
      plain("accessKeyId", "Access key ID"),
      secret("secretKey", "Secret key"),
    ],
    grant: {
      url: "${apiUrl}/login",
      encoding: "json",
      body: "{\"username\":\"${accessKeyId}\",\"password\":\"${secretKey}\"}",
      tokenField: "token",
    },
    verify: {
      method: "GET",
      url: "${apiUrl}/check",
      headers: { "x-redlock-auth": "${accessToken}" },
    },
    collects: "connection-only",
  },

  // ── Logging and monitoring ────────────────────────────────────────────────
  {
    key: "datadog",
    state: "live",
    authShape: "header",
    fields: [
      plain("site", "Datadog site", { placeholder: "datadoghq.com", required: false }),
      secret("apiKey", "API key"),
      secret("appKey", "Application key"),
    ],
    verify: {
      method: "GET",
      // Requires both keys, unlike /api/v1/validate which only checks the API key.
      url: "https://api.${site|datadoghq.com}/api/v1/monitor?with_downtimes=false",
      headers: { "DD-API-KEY": "${apiKey}", "DD-APPLICATION-KEY": "${appKey}" },
    },
    collects: "connection-only",
  },
  {
    key: "splunk",
    state: "live",
    authShape: "header",
    fields: [
      plain("baseUrl", "Management URL", { placeholder: "https://acme.splunkcloud.com:8089" }),
      secret("token", "Authentication token"),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl}/services/authentication/current-context?output_mode=json",
      headers: { Authorization: "Bearer ${token}" },
    },
    collects: "connection-only",
  },
  {
    key: "elastic-siem",
    state: "live",
    authShape: "header",
    fields: [
      plain("baseUrl", "Elasticsearch URL", { placeholder: "https://acme.es.us-east-1.aws.found.io" }),
      secret("apiKey", "API key", { help: "The base64 id:api_key value" }),
    ],
    verify: {
      method: "GET",
      url: "${baseUrl}/_security/_authenticate",
      headers: { Authorization: "ApiKey ${apiKey}" },
    },
    collects: "connection-only",
  },

  // ── Secrets and privileged access ─────────────────────────────────────────
  {
    key: "hashicorp-vault",
    state: "live",
    authShape: "header",
    fields: [
      plain("vaultAddr", "Vault address", { placeholder: "https://vault.acme.com" }),
      secret("token", "Vault token"),
      plain("namespace", "Namespace", { required: false }),
    ],
    verify: {
      method: "GET",
      url: "${vaultAddr}/v1/auth/token/lookup-self",
      headers: { "X-Vault-Token": "${token}" },
    },
    note: "A Vault reachable only on a private network is refused by the outbound SSRF guard, not by Vault.",
    collects: "connection-only",
  },

  // ── Identity ──────────────────────────────────────────────────────────────
  {
    key: "auth0",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("domain", "Tenant domain", { placeholder: "acme.eu.auth0.com" }),
      plain("clientId", "Machine-to-machine client ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://${domain}/oauth/token",
      encoding: "json",
      body: "{\"grant_type\":\"client_credentials\",\"client_id\":\"${clientId}\",\"client_secret\":\"${clientSecret}\",\"audience\":\"https://${domain}/api/v2/\"}",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://${domain}/api/v2/users?per_page=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "ping",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("environmentId", "PingOne environment ID"),
      plain("clientId", "Worker application client ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://auth.pingone.com/${environmentId}/as/token",
      encoding: "form",
      body: "grant_type=client_credentials",
      headers: { Authorization: "Basic ${basic:clientId:clientSecret}" },
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://api.pingone.com/v1/environments/${environmentId}",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "sailpoint",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantUrl", "API URL", { placeholder: "https://acme.api.identitynow.com" }),
      plain("clientId", "Personal access token ID"),
      secret("clientSecret", "Personal access token secret"),
    ],
    grant: {
      url: "${tenantUrl}/oauth/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "${tenantUrl}/v3/identities?limit=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },

  // ── Microsoft Graph family ────────────────────────────────────────────────
  //
  // One app registration, four catalogue entries. They differ only in the
  // verification call and in the Graph permissions the customer has to grant,
  // so each entry names the permission it needs rather than failing silently
  // when it is absent.
  {
    key: "microsoft-365",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://graph.microsoft.com/v1.0/organization",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    note: "Needs Organization.Read.All as an application permission, with admin consent granted.",
    collects: "connection-only",
  },
  {
    key: "azure-ad",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies?%24top=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    note: "Needs Policy.Read.All. Conditional access evidence is unavailable without it.",
    collects: "connection-only",
  },
  {
    key: "microsoft-intune",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?%24top=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    note: "Needs DeviceManagementManagedDevices.Read.All.",
    collects: "connection-only",
  },
  {
    key: "microsoft-teams",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://graph.microsoft.com/v1.0/organization",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    note:
      "Verified against the tenant, not against Teams. Retention and guest-access evidence additionally " +
      "needs the Teams administrative roles, which this check does not prove.",
    collects: "connection-only",
  },
  {
    key: "azure-key-vault",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("vaultName", "Key vault name"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fvault.azure.net%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://${vaultName}.vault.azure.net/secrets?api-version=7.4&maxresults=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "azure-defender",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantId", "Directory (tenant) ID"),
      plain("subscriptionId", "Subscription ID"),
      plain("clientId", "Application (client) ID"),
      secret("clientSecret", "Client secret"),
    ],
    grant: {
      url: "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https%3A%2F%2Fmanagement.azure.com%2F.default",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "https://management.azure.com/subscriptions/${subscriptionId}?api-version=2020-01-01",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },

  // ── HR, training and support ──────────────────────────────────────────────
  {
    key: "bamboohr",
    state: "live",
    authShape: "basic",
    fields: [
      plain("subdomain", "Company subdomain", { placeholder: "acme" }),
      secret("apiKey", "API key"),
    ],
    verify: {
      method: "GET",
      url: "https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/employees/directory",
      headers: { Authorization: "Basic ${basic:apiKey:x}", Accept: "application/json" },
    },
    collects: "connection-only",
  },
  {
    key: "knowbe4",
    state: "live",
    authShape: "header",
    fields: [
      plain("region", "API region", { placeholder: "us", required: false, help: "us, eu, ca, uk or de" }),
      secret("apiKey", "API key"),
    ],
    verify: {
      method: "GET",
      url: "https://${region|us}.api.knowbe4.com/v1/training/campaigns?per_page=1",
      headers: { Authorization: "Bearer ${apiKey}" },
    },
    collects: "connection-only",
  },
  {
    key: "greenhouse",
    state: "live",
    authShape: "basic",
    fields: [secret("apiKey", "Harvest API key")],
    verify: {
      method: "GET",
      url: "https://harvest.greenhouse.io/v1/users?per_page=1",
      headers: { Authorization: "Basic ${basic:apiKey:}" },
    },
    collects: "connection-only",
  },
  {
    key: "zendesk",
    state: "live",
    authShape: "basic",
    fields: [
      plain("subdomain", "Zendesk subdomain", { placeholder: "acme" }),
      plain("email", "Agent email"),
      secret("apiToken", "API token"),
    ],
    verify: {
      method: "GET",
      url: "https://${subdomain}.zendesk.com/api/v2/users/me.json",
      headers: { Authorization: "Basic ${basic:email/token:apiToken}" },
    },
    note: "Zendesk expects the username as <email>/token. Each side of a basic template is a slash-joined list of field-or-literal tokens, so email/token resolves the field and appends the literal.",
    collects: "connection-only",
  },
  {
    key: "workday",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("tenantUrl", "Tenant URL", { placeholder: "https://wd2-impl-services1.workday.com/ccx/oauth2/acme" }),
      plain("clientId", "API client ID"),
      secret("clientSecret", "API client secret"),
      secret("refreshToken", "Refresh token"),
    ],
    grant: {
      url: "${tenantUrl}/token",
      encoding: "form",
      body: "grant_type=refresh_token&refresh_token=${refreshToken}",
      headers: { Authorization: "Basic ${basic:clientId:clientSecret}" },
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "${tenantUrl}/v1/workers?limit=1",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },

  // ── Device management ─────────────────────────────────────────────────────
  {
    key: "jamf",
    state: "live",
    authShape: "token-grant",
    fields: [
      plain("baseUrl", "Jamf Pro URL", { placeholder: "https://acme.jamfcloud.com" }),
      plain("clientId", "API client ID"),
      secret("clientSecret", "API client secret"),
    ],
    grant: {
      url: "${baseUrl}/api/oauth/token",
      encoding: "form",
      body: "grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}",
      tokenField: "access_token",
    },
    verify: {
      method: "GET",
      url: "${baseUrl}/api/v1/jamf-pro-version",
      headers: { Authorization: "Bearer ${accessToken}" },
    },
    collects: "connection-only",
  },
  {
    key: "kubernetes",
    state: "live",
    authShape: "header",
    fields: [
      plain("apiServerUrl", "API server URL", { placeholder: "https://k8s.acme.com" }),
      secret("token", "Service account token"),
    ],
    verify: {
      method: "GET",
      url: "${apiServerUrl}/version",
      headers: { Authorization: "Bearer ${token}" },
    },
    note:
      "A cluster reachable only on a private network is refused by the outbound SSRF guard rather than by " +
      "Kubernetes. That guard is not negotiable from a tenant configuration field.",
    collects: "connection-only",
  },

  // ── Cannot be reached by this engine ──────────────────────────────────────
  //
  // Each of these needs a request-signing scheme, a client certificate, or a
  // consent flow the platform does not host. They are listed with the reason
  // rather than removed, because "why can I not connect this" is a question the
  // catalogue should answer.
  unavailable(
    "google-workspace",
    "Google service accounts authenticate with an RS256-signed JWT assertion, which this connector engine " +
      "cannot construct. A Google-specific connector is needed.",
  ),
  unavailable(
    "gcp",
    "Google Cloud authenticates with an RS256-signed JWT assertion from a service account key. Needs a " +
      "Google-specific connector.",
  ),
  unavailable(
    "gcp-scc",
    "Same Google service-account signing requirement as GCP above.",
  ),
  unavailable(
    "google-gcr",
    "Same Google service-account signing requirement as GCP above.",
  ),
  unavailable(
    "duo",
    "Duo signs every individual request with an HMAC over the method, host, path and parameters. That cannot " +
      "be expressed as a header template.",
  ),
  unavailable(
    "veracode",
    "Veracode uses HMAC request signing per call. Needs a Veracode-specific connector.",
  ),
  unavailable(
    "netsuite",
    "NetSuite token-based authentication is OAuth 1.0a with a per-request HMAC-SHA256 signature.",
  ),
  unavailable(
    "adp",
    "ADP requires a client certificate for mutual TLS, which is an infrastructure change rather than a " +
      "credential the customer can paste in.",
  ),
  unavailable(
    "gusto",
    "Gusto only offers authorization-code OAuth, which needs a registered redirect URI and a consent screen " +
      "this platform does not yet host.",
  ),
  unavailable(
    "aws-security-hub",
    "Needs AWS SigV4 request signing. The AWS connector above already collects IAM, CloudTrail, S3 and " +
      "GuardDuty evidence with the same credentials; Security Hub aggregation is not yet built on top of it.",
  ),
  unavailable(
    "aws-config",
    "Needs AWS SigV4 request signing. Use the AWS connector above, which shares the same credentials.",
  ),
  unavailable(
    "aws-guardduty",
    "Already covered. The AWS connector above queries GuardDuty directly with the same credentials, so this " +
      "entry is a duplicate rather than a gap.",
  ),
  unavailable(
    "aws-secrets-manager",
    "Needs AWS SigV4 request signing. Use the AWS connector above, which shares the same credentials.",
  ),
  unavailable(
    "amazon-ecr",
    "Needs AWS SigV4 request signing.",
  ),
  unavailable(
    "orca",
    "No documented credential-verification endpoint was confirmed, and a guessed one would fail in a way a " +
      "customer would read as their own mistake.",
  ),
  unavailable(
    "lacework",
    "Lacework token exchange varies by deployment and was not confirmed against documentation.",
  ),
  unavailable(
    "cyberark",
    "Authentication differs between Privilege Cloud and self-hosted PVWA. Needs a deployment-aware connector.",
  ),
  unavailable(
    "beyondtrust",
    "Authentication differs between Password Safe and Remote Support. Needs a deployment-aware connector.",
  ),
  unavailable(
    "checkmarx",
    "Authentication differs between Checkmarx One and Checkmarx SAST. Needs a product-aware connector.",
  ),
  unavailable(
    "proofpoint",
    "The TAP SIEM API requires a time-window parameter on every call and no self endpoint was confirmed.",
  ),
  unavailable(
    "rippling",
    "No credential-verification endpoint was confirmed against documentation.",
  ),
];

const BY_KEY = new Map(CONNECTOR_SPECS.map((s) => [s.key, s]));

export function connectorSpec(key: string): ConnectorSpec | undefined {
  return BY_KEY.get(key);
}

/**
 * Every field any spec marks secret, lower-cased.
 *
 * This is the reason the registry is declarative. integration-redaction.ts used
 * a hand-written list of credential key names, and a hand-written list is
 * exactly as complete as whoever last remembered to edit it: "botToken",
 * "secretKey", "appKey", "clientSecret" and "refreshToken" were all absent from
 * it while providers in this repository were storing them. Deriving the set
 * from the specs means adding a connector cannot forget to protect its own
 * secret - the same declaration does both jobs.
 */
export function secretFieldKeys(): Set<string> {
  const out = new Set<string>();
  for (const spec of CONNECTOR_SPECS) {
    for (const field of spec.fields) {
      if (field.secret) out.add(field.key.toLowerCase());
    }
  }
  return out;
}

/** The secret field keys for one connector, in their original casing. */
export function secretFieldsFor(key: string): string[] {
  return (connectorSpec(key)?.fields ?? []).filter((f) => f.secret).map((f) => f.key);
}

/**
 * What the browser is allowed to know about a spec.
 *
 * The verification request is not included. It carries header templates naming
 * credential fields, and while none of it is itself a secret, publishing the
 * exact call the server makes with a customer's token is free reconnaissance
 * for no product benefit. The UI needs the fields and the labels; it does not
 * need the request.
 */
export function publicSpec(spec: ConnectorSpec) {
  return {
    key: spec.key,
    state: spec.state,
    fields: spec.fields.map((f) => ({
      key: f.key,
      label: f.label,
      secret: f.secret,
      required: f.required,
      placeholder: f.placeholder ?? null,
      help: f.help ?? null,
    })),
    docsUrl: spec.docsUrl ?? null,
    unavailableReason: spec.unavailableReason ?? null,
    collects: spec.collects,
    note: spec.note ?? null,
    /** Verification happens server side; the client only needs to know it will. */
    verifiedOnConnect: Boolean(spec.verify),
  };
}

export function connectorSummary() {
  const counts = { native: 0, live: 0, unavailable: 0 };
  for (const spec of CONNECTOR_SPECS) counts[spec.state] += 1;
  return {
    ...counts,
    total: CONNECTOR_SPECS.length,
    /**
     * Stated so the number cannot be read as more than it is. "live" means a
     * customer's own credentials are accepted and proved against the vendor's
     * API. It does not mean automated control testing is implemented for that
     * vendor - see the collects field on each spec.
     */
    liveMeaning:
      "credentials are captured, encrypted, and proved against the vendor's own API before the " +
      "integration is marked connected",
  };
}
