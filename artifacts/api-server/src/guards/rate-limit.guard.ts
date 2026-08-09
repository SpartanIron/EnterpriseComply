/**
 * RateLimitGuard — selectively applies exactly one named throttler per route
 * and normalizes rate-limit response headers.
 *
 * With three named throttlers configured globally (default, auth, webhook),
 * the stock ThrottlerGuard would apply ALL of them to every route — the most
 * restrictive (auth at 5/min) would dominate everywhere.  This guard instead
 * selects a single profile per route based on explicit @Throttle metadata:
 *
 *   No decorator                  → "default" (api) throttler — 120 req/60s
 *   @Throttle({ auth: {...} })    → "auth" throttler          —   5 req/60s
 *   @Throttle({ webhook: {...} }) → "webhook" throttler        — 300 req/60s
 *   @SkipThrottle()               → no throttling (public/health endpoints)
 *
 * Per-route limit overrides for the "default" profile are also supported:
 *   @Throttle({ default: { limit: 5, ttl: 60000 } })
 *   — retains the "default" profile but tightens the limit to 5/min.
 *   This is how SSP generate (5/min) and gap-analysis (8/min) are enforced.
 *
 * Header normalization:
 *   @nestjs/throttler emits Retry-After-<name> for named (non-default) profiles.
 *   This guard always adds the standard Retry-After header alongside any suffixed
 *   variant so clients can rely on a single well-known header name on every 429.
 *
 * Standard rate-limit headers set on all throttled routes:
 *   X-RateLimit-Limit        — limit for the active throttler profile
 *   X-RateLimit-Remaining    — remaining hits in the current window
 *   X-RateLimit-Reset        — seconds until the window resets
 *   Retry-After              — seconds to wait on 429 (always present)
 */
import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

// Metadata key constants — must match @nestjs/throttler internals
const LIMIT_KEY = "THROTTLER:LIMIT";
const TTL_KEY   = "THROTTLER:TTL";
const SKIP_KEY  = "THROTTLER:SKIP";

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  // ── Profile selection ──────────────────────────────────────────────────────
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler  = context.getHandler();
    const classRef = context.getClass();

    // Determine which throttler profile this route explicitly targets.
    // Routes with @Throttle({ auth: { limit, ttl } })    → auth profile
    // Routes with @Throttle({ webhook: { limit, ttl } }) → webhook profile
    // All other routes (including those with @Throttle({ default: {...} }))
    //   → default profile (with optional limit/ttl override from the decorator)
    const hasAuthLimit    = this.reflector.getAllAndOverride(LIMIT_KEY + "auth",    [handler, classRef]) != null;
    const hasWebhookLimit = this.reflector.getAllAndOverride(LIMIT_KEY + "webhook", [handler, classRef]) != null;
    const profile = hasAuthLimit ? "auth" : hasWebhookLimit ? "webhook" : "default";

    // ── Skip checks ───────────────────────────────────────────────────────────
    // @SkipThrottle() (no args) → sets THROTTLER:SKIPdefault = true (framework default)
    const skipProfile = !!this.reflector.getAllAndOverride(SKIP_KEY + profile,   [handler, classRef]);
    const skipDefault = !!this.reflector.getAllAndOverride(SKIP_KEY + "default", [handler, classRef]);
    if (skipProfile || skipDefault) return true;

    // ── Locate the matching throttler configuration ────────────────────────────
    type ThrottlerCfg = {
      name: string; limit: number; ttl: number; blockDuration?: number;
      getTracker?: Function; generateKey?: Function; setHeaders?: boolean;
    };
    const throttlers = (this as any).throttlers as ThrottlerCfg[];
    const throttler  = throttlers.find((t) => t.name === profile);
    if (!throttler) return true; // config missing → allow (fail open)

    // ── Route-level overrides from @Throttle({ profile: { limit, ttl } }) ─────
    const routeLimit = this.reflector.getAllAndOverride<number>(LIMIT_KEY + profile, [handler, classRef]);
    const routeTtl   = this.reflector.getAllAndOverride<number>(TTL_KEY   + profile, [handler, classRef]);
    const limit = routeLimit ?? throttler.limit;
    const ttl   = routeTtl   ?? throttler.ttl;

    const common      = (this as any).commonOptions ?? {};
    const getTracker  = throttler.getTracker  ?? common.getTracker;
    const generateKey = throttler.generateKey ?? common.generateKey;

    return this.handleRequest({
      context,
      limit,
      ttl,
      throttler,
      blockDuration: throttler.blockDuration ?? ttl,
      getTracker,
      generateKey,
    } as any);
  }

  // ── Retry-After normalization ──────────────────────────────────────────────
  // @nestjs/throttler sets Retry-After-<name> for named profiles (e.g. auth,
  // webhook).  We override handleRequest to ALSO set the standard Retry-After
  // so clients always have a single reliable header to read on any 429.
  protected async handleRequest(requestProps: any): Promise<boolean> {
    try {
      return await super.handleRequest(requestProps);
    } catch (err) {
      // ThrottlerException was thrown (request blocked).  The parent already set
      // Retry-After-<name> for named profiles; add the canonical Retry-After too.
      const { context, throttler } = requestProps;
      if (throttler.name !== "default") {
        const { res } = this.getRequestResponse(context);
        const expRes = res as import("express").Response;
        const suffixedHeader = expRes.getHeader?.(`Retry-After-${throttler.name}`);
        if (suffixedHeader != null) {
          expRes.setHeader("Retry-After", String(suffixedHeader));
        }
      }
      throw err;
    }
  }
}
