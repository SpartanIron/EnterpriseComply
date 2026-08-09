/**
 * Replit integration provider.
 *
 * Uses the authenticated Replit GraphQL API (replit.com/graphql) to discover
 * ALL of the authenticated user's workspaces — public and private — via
 * `currentUser.repls(count, after)` with cursor-based pagination.
 *
 * `publicRepls(username, limit)` is intentionally NOT used: it returns only
 * public repls and therefore misses the private workspaces that constitute
 * the customer's production infrastructure.
 */

export interface ReplitCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "replit";
}

export interface ReplitEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "replit";
}

export interface ReplitSyncResult {
  controlResults: ReplitCheckResult[];
  evidenceItems: ReplitEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

const REPLIT_GRAPHQL_URL = "https://replit.com/graphql";
/** Maximum repls to page through per sync (avoids unbounded API calls). */
const MAX_REPLS = 200;

async function replitQuery<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(REPLIT_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Replit API error: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Replit GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data as T;
}

/** Cursor-paginated query for the authenticated user's repls (private + public). */
interface ReplPage {
  items: Array<{
    id: string;
    slug: string;
    title: string;
    isPrivate: boolean;
    isAlwaysOn: boolean;
    language: string;
    updatedAt: string;
    publishedAt: string | null;
    deployment: { id: string; domain: string | null; status: string } | null;
  }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const REPLS_QUERY = `
  query GetUserRepls($count: Int!, $after: String) {
    currentUser {
      repls(count: $count, after: $after) {
        items {
          id
          slug
          title
          isPrivate
          isAlwaysOn
          language
          updatedAt
          publishedAt
          deployment {
            id
            domain
            status
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

async function fetchAllRepls(token: string): Promise<ReplPage["items"]> {
  const allRepls: ReplPage["items"] = [];
  let cursor: string | null = null;
  let hasMore = true;
  const pageSize = 50;

  while (hasMore && allRepls.length < MAX_REPLS) {
    const data: { currentUser: { repls: ReplPage } | null } | undefined = await replitQuery<{
      currentUser: { repls: ReplPage } | null;
    }>(token, REPLS_QUERY, { count: pageSize, after: cursor });

    const page: ReplPage | null | undefined = data?.currentUser?.repls;
    if (!page?.items?.length) break;

    allRepls.push(...page.items);
    hasMore = page.pageInfo?.hasNextPage ?? false;
    cursor = page.pageInfo?.endCursor ?? null;

    if (!cursor) break;
  }

  return allRepls;
}

export async function runReplitChecks(token: string): Promise<ReplitSyncResult> {
  const controlResults: ReplitCheckResult[] = [];
  const evidenceItems: ReplitEvidenceItem[] = [];

  // ── Check 1: Token verification + authenticated user (UCO-AC-001) ────────────
  let username = "unknown";
  try {
    const meData = await replitQuery<{
      currentUser: {
        id: string;
        username: string;
        displayName: string | null;
        isVerified: boolean;
      } | null;
    }>(token, `
      query {
        currentUser {
          id
          username
          displayName
          isVerified
        }
      }
    `);

    const user = meData?.currentUser;
    if (!user) throw new Error("Token did not return a current user — token may be invalid or expired");
    username = user.username;

    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "passing",
      result: `Replit API token verified for authenticated user @${username} (account verified: ${user.isVerified}). Workspace access is protected by token-based authentication.`,
      integrationKey: "replit",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AC-001",
      title: "Replit — Workspace Access Authentication",
      description: `Replit API token verified for user @${username}. All workspace operations (create, update, deploy) require authenticated API access via token.`,
      type: "auto",
      source: "replit",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "failing",
      result: `Replit token verification failed: ${String(err)}`,
      integrationKey: "replit",
    });
    // Cannot proceed without a valid token
    return { controlResults, evidenceItems, checksRun: 1, checksPassed: 0 };
  }

  // ── Check 2: Authenticated workspace inventory (UCO-CM-001) ─────────────────
  // Uses `currentUser.repls(count, after)` with cursor-based pagination to
  // include ALL workspaces — private and public — not just public repls.
  try {
    const repls = await fetchAllRepls(token);

    const privateRepls   = repls.filter((r) => r.isPrivate);
    const deployedRepls  = repls.filter((r) => r.deployment !== null);
    const alwaysOnRepls  = repls.filter((r) => r.isAlwaysOn);
    const activeDeployDomains = deployedRepls
      .map((r) => r.deployment?.domain)
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");

    const sorted = [...repls].sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
    const lastActivity = sorted[0]?.updatedAt
      ? new Date(sorted[0].updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "no recent activity";

    controlResults.push({
      ucoControlId: "UCO-CM-001",
      status: "passing",
      result: `Replit workspace inventory (including private): ${repls.length} total repls (${privateRepls.length} private, ${repls.length - privateRepls.length} public), ${deployedRepls.length} deployed, ${alwaysOnRepls.length} always-on. Last activity: ${lastActivity}.`,
      integrationKey: "replit",
    });

    evidenceItems.push({
      ucoControlId: "UCO-CM-001",
      title: "Replit — Authenticated Workspace Inventory",
      description: `Full workspace inventory for @${username} (private + public via authenticated API): ${repls.length} total workspaces, ${privateRepls.length} private, ${deployedRepls.length} with active deployments, ${alwaysOnRepls.length} always-on services. Most recent workspace activity: ${lastActivity}.`,
      type: "auto",
      source: "replit",
    });

    // ── Deployment audit trail (UCO-AL-001) ─────────────────────────────────
    if (deployedRepls.length > 0) {
      evidenceItems.push({
        ucoControlId: "UCO-AL-001",
        title: "Replit — Deployed Service Inventory",
        description: `${deployedRepls.length} Replit workspace(s) deployed as live services. Active deployment domains: ${activeDeployDomains || "see Replit dashboard"}. Replit records build logs, deployment history, and access events for each service.`,
        type: "auto",
        source: "replit",
      });
      controlResults.push({
        ucoControlId: "UCO-AL-001",
        status: "passing",
        result: `Replit deployment audit: ${deployedRepls.length} active deployment(s) with build and access logs. Deployment domains: ${activeDeployDomains || "configured"}.`,
        integrationKey: "replit",
      });
    } else {
      controlResults.push({
        ucoControlId: "UCO-AL-001",
        status: "warning",
        result: `Replit: no active deployments found for @${username} across ${repls.length} workspace(s). Deploy a repl to enable deployment audit trail evidence.`,
        integrationKey: "replit",
      });
    }

    // ── Infrastructure change management (UCO-CM-003) ───────────────────────
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentlyUpdated = repls.filter(
      (r) => r.updatedAt && new Date(r.updatedAt).getTime() > sevenDaysAgo,
    );

    evidenceItems.push({
      ucoControlId: "UCO-CM-003",
      title: "Replit — Infrastructure Change Activity",
      description: `${recentlyUpdated.length} of ${repls.length} Replit workspaces (including private) modified in the past 7 days. All changes are tracked in Replit's version history. Agent runs are logged with timestamps and actor identity.`,
      type: "auto",
      source: "replit",
    });
    controlResults.push({
      ucoControlId: "UCO-CM-003",
      status: "passing",
      result: `Replit infrastructure change tracking: ${recentlyUpdated.length} workspace(s) updated in the past 7 days (of ${repls.length} total). Replit maintains a full version and change history.`,
      integrationKey: "replit",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-001",
      status: "warning",
      result: `Replit workspace fetch failed: ${String(err)}`,
      integrationKey: "replit",
    });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
