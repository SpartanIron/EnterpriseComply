---
name: Rate-limit test isolation in test-suite.mjs
description: Pattern for preventing throttle_hits accumulation from corrupting rate-limit section tests between runs
---

## Rule
Section 15 of `test-suite.mjs` uses static X-Forwarded-For IPs (`10.15.10.1`–`10.15.10.6`) to test rate limiting. Without pre-run cleanup these IPs accumulate `throttle_hits` and `ip_failure_tracker` rows between runs, causing "within-limit" requests to be throttled on the very first attempt.

## Pattern
At the top of any rate-limit test section, flush the test IPs before running:

```javascript
await db.query(`DELETE FROM throttle_hits WHERE ip LIKE '10.15.10.%'`).catch(() => {});
await db.query(`DELETE FROM ip_failure_tracker WHERE ip LIKE '10.15.10.%'`).catch(() => {});
```

**Why:**
- The throttle window is 1 minute, but test suite runs can happen faster than that window expires
- Static IPs were chosen to isolate within-run tests from each other, but they accumulate across runs

**How to apply:**
- Any time a new rate-limit test section is added, use a dedicated IP subnet and flush it at section start
- The `10.15.10.0/24` range is reserved for Section 15; new sections should use a different subnet (e.g. `10.15.11.x`)
