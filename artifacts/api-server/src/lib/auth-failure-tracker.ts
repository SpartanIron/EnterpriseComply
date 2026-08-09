/**
 * auth-failure-tracker.ts — In-memory IP-based auth failure block.
 *
 * After FAILURE_THRESHOLD consecutive auth failures from the same source IP
 * within FAILURE_WINDOW_MS, that IP is blocked for BLOCK_DURATION_MS.
 * Blocked IPs should receive HTTP 429 with Retry-After: BLOCK_SECONDS.
 *
 * NIST AC-7: limit consecutive invalid logon attempts.
 *
 * NOTE: Single-instance only.  For distributed deployments replace the Map
 *       with a Redis-backed counter (INCRBY + EXPIREAT).
 */

const FAILURE_WINDOW_MS  = 15 * 60 * 1000; // 15-minute sliding window
const FAILURE_THRESHOLD  = 10;             // failures before block
const BLOCK_DURATION_MS  = 15 * 60 * 1000; // block duration after threshold
export const BLOCK_SECONDS = 900;          // Retry-After value (seconds)

interface Entry {
  count:       number;
  windowStart: number;
  blockedUntil: number | null;
}

const failureMap = new Map<string, Entry>();

/**
 * Record one auth failure for an IP.
 * @returns true if the IP is now blocked (crossed threshold on THIS call or was already blocked)
 */
export function recordAuthFailure(ip: string): boolean {
  const now   = Date.now();
  const entry = failureMap.get(ip);

  if (!entry) {
    failureMap.set(ip, { count: 1, windowStart: now, blockedUntil: null });
    return false;
  }

  // Already blocked — re-check; block duration might have expired
  if (entry.blockedUntil !== null) {
    if (now < entry.blockedUntil) return true; // still blocked
    // Block expired — reset and start a fresh window
    entry.count       = 1;
    entry.windowStart = now;
    entry.blockedUntil = null;
    return false;
  }

  // Window expired — reset
  if (now - entry.windowStart > FAILURE_WINDOW_MS) {
    entry.count       = 1;
    entry.windowStart = now;
    return false;
  }

  // Increment and check threshold
  entry.count++;
  if (entry.count >= FAILURE_THRESHOLD) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    return true;
  }
  return false;
}

/**
 * Check if an IP is currently blocked without recording a failure.
 */
export function isIpBlocked(ip: string): boolean {
  const now   = Date.now();
  const entry = failureMap.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil !== null && now < entry.blockedUntil) return true;
  return false;
}

/**
 * Seconds remaining until the block expires (for the Retry-After header).
 */
export function blockRemainingSeconds(ip: string): number {
  const now   = Date.now();
  const entry = failureMap.get(ip);
  if (!entry?.blockedUntil) return BLOCK_SECONDS;
  return Math.max(0, Math.ceil((entry.blockedUntil - now) / 1000));
}

/** Reset a specific IP — used in automated tests to clear state between runs. */
export function resetIpFailures(ip: string): void {
  failureMap.delete(ip);
}
