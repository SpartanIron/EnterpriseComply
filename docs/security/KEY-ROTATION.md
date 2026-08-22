# Adopting and rotating INTEGRATION_CREDENTIAL_KEY

This is the operator runbook for the key that seals every stored secret in the
platform. Read the order of operations before touching anything: the variable
must be set **after** the re-encryption, never before.

## What the key is

`INTEGRATION_CREDENTIAL_KEY` is a 32-byte key, supplied as a 64-character hex
string, used as the AES-256-GCM key in `src/lib/credential-crypto.ts`. Sealed
values are stored as `enc:v1:<iv>$<ciphertext>$<tag>`.

Key selection, in priority order:

1. `INTEGRATION_CREDENTIAL_KEY`, when it is a valid 32-byte hex string.
2. Otherwise an HMAC-SHA256 of `SESSION_SECRET`, or of `BETTER_AUTH_SECRET`,
   over a fixed label. This is the documented fallback and it logs a warning at
   startup.
3. A development-only constant, unreachable outside development because startup
   validation throws first.

`GET /api/admin/credentials/key-status` reports which of these is live, as
`mode: "dedicated" | "derived" | "dev-fallback"`, together with a one-way
fingerprint of the key and a count of stored secrets that still open with it.

## What the key protects

Everything below is sealed with the same key, which is why they must all be
re-encrypted together:

| Store | Column | Written by |
| --- | --- | --- |
| `org_integrations` | `access_token`, `refresh_token` | integrations service, Google Workspace service |
| `org_integrations` | credential members of the `config` JSONB | integrations service |
| `two_factor` | `secret` | MFA service, on enrolment |
| `mfa_enrollment` | `secret` | MFA service, while a setup is pending |

Backup codes in `two_factor."backupCodes"` are hashed, not encrypted, so they
are unaffected by a key change and are deliberately not touched by rotation.

## Why the order matters

Setting the variable first would change the key under data that is still sealed
with the old one. Integrations would fail to sync and, worse, every enrolled
member would be unable to pass second-factor verification. Where organisation
wide MFA is enforced, that is a lockout, not a degradation.

Re-encryption therefore happens while the old key is still live, through an
endpoint that holds both keys for the length of one transaction.

## Procedure

Prerequisites: platform super-admin, plus a standing elevation. Privileged
admin routes answer `403 elevation_required` until you open a time-boxed
elevation with a reason and an authenticator code.

1. **Generate the key.** On your own machine, never in a shared shell history:

   ```
   openssl rand -hex 32
   ```

   Store it in the password manager immediately, labelled with the date. It
   cannot be recovered from the application, and without it every stored
   secret is unrecoverable. See `docs/security/DR_BCP.md`.

2. **Record the starting point.**

   ```
   GET /api/admin/credentials/key-status
   ```

   Expect `mode: "derived"` on a deployment that has never had a dedicated key,
   `undecryptable: 0`, and a fingerprint. Keep the response.

3. **Dry run the rotation.** Omit `oldKeyHex`: it then defaults to the key that
   is live right now, which is exactly what you want for a first adoption.

   ```
   POST /api/admin/credentials/rotate-key
   { "newKeyHex": "<the value from step 1>", "dryRun": true }
   ```

   Read `summary`. `wouldRotate` and `mfaSecretsWouldRotate` must be non-zero if
   you have connected integrations and enrolled members. `failures` and
   `mfaFailures` must both be zero. If they are not, stop: a non-zero failure
   count means some rows are already on a different key, and applying would
   leave them unreadable.

4. **Apply.** Same call without `dryRun`. It runs in one transaction, is
   idempotent, and refuses to report `ok: true` if any row or any authenticator
   secret failed.

   Each affected organisation gets a `credential_key.rotated` audit row
   carrying the old and new fingerprints. No key material is written anywhere.

5. **Set the variable.** Only now. Railway → the API service → Variables → New
   Variable → name `INTEGRATION_CREDENTIAL_KEY`, value the hex string from step
   1. Railway redeploys on save.

6. **Verify.** After the deployment reports success:

   ```
   GET /api/admin/credentials/key-status
   ```

   Required: `mode: "dedicated"`, `healthy: true`, `undecryptable: 0`, and a
   fingerprint matching `newKeyFingerprint` from step 4. Then confirm one real
   behaviour of each kind: an integration sync that succeeds, and a fresh
   authenticator code that verifies.

## If step 6 shows undecryptable rows

The variable was set without the rotation, or with a different key than the one
rotated to. Do not re-run the rotation against the new key: the old key is no
longer live, so nothing can be decrypted. Restore the previous variable value
from the password manager, redeploy, confirm `undecryptable: 0`, and start again
at step 3.

If the previous state was `derived`, restoring means removing the variable
entirely so the fallback resumes. `BETTER_AUTH_SECRET` must not have changed in
the meantime, which is the reason the derived mode is a liability and not a
resting place.

## Routine rotation

The same procedure, with `oldKeyHex` set explicitly to the outgoing key. The
endpoint refuses a `newKeyHex` whose fingerprint was retired by an earlier
rotation, and refuses one that equals the key already in use, so a stale entry
in the password manager cannot silently move you backwards.

## What this does not do

It does not put the key in a key management service. The key still lives in the
process environment, so anyone who can read the service configuration can read
it. Per-organisation data keys wrapped by a master key the application never
holds in plaintext are roadmap items R-01 through R-06.
