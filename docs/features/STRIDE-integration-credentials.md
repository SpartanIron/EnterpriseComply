# STRIDE - third-party integration credentials

Gate for the credential-based connector work. Written before the engine, because
the whole feature is a new trust boundary: the platform starts holding
credentials that read a customer's identity provider, their cloud account and
their ticketing system, and starts making outbound calls with them.

## Measured starting position

At commit 53246df, before this change:

- 65 catalogue entries. 7 had a real connector.
- The other 58 called `POST /orgs/:id/integrations/:key/demo-connect`, which wrote
  a control result per catalogue control with `Math.random() > 0.15` and
  evidence rows for scans that had not run.
- 16 provider modules existed with real API code, unwired, reading credentials
  from `integration.config` in plaintext field names such as `botToken` and
  `secretKey`.
- `CREDENTIAL_CONFIG_KEYS` in `integration-redaction.ts` did not contain
  `bottoken`, `secretkey`, `appkey`, `clientsecret` or `refreshtoken`.

## Assets

1. Customer-supplied third-party credentials, at rest and in transit.
2. The org_integrations rows that point at them.
3. The platform's own outbound network position.
4. The integrity of org_control_results, which is what the compliance score is.

## Trust boundaries crossed

- Browser to API: the credential arrives from a customer's machine.
- API to vendor: an outbound request whose destination is partly tenant-controlled.
- API to database: the credential comes to rest.
- Vendor to API: the response, including error text a vendor may have written.

## S - Spoofing

*A tenant claims a connection they never proved.* Old behaviour: exactly this, by
design. demo-connect marked an integration connected without contacting anyone.
Now the row is only written after a real authenticated call succeeded, and a
failed verification stores nothing.

*A caller impersonates the owner.* Unchanged: `RequireRole("owner")` on connect,
matching the existing credential connectors.

## T - Tampering

*Header injection.* Credential values are interpolated into outbound headers. CR
and LF are rejected in every submitted value, secrets included, before any
template is resolved.

*Host and path smuggling.* Non-secret values land in URLs. They are restricted to
a hostname-safe character set, and URL fields must parse as https, so
`acme.atlassian.net/../../x` cannot redirect the call.

*Template expansion.* Substitution is single pass. A field whose value contains a
placeholder is text, so one credential cannot be made to expand into another.

*Undeclared fields.* Only fields the spec declares are stored. An extra property
in the request body cannot reach the config column, where it would sit outside
every rule about what is a secret.

## R - Repudiation

Connect, connect-failure and disconnect are all written to the audit log, with
the actor, the vendor's status, and which field names were supplied. Never the
values.

## I - Information disclosure

*Serialisation.* The redaction set is now derived from the specs, so a
connector's declared secret is protected by the same declaration that asks for
it. The five names missing from the hand-written list are covered and asserted
by name in the guard.

*Error text.* Vendors echo tokens back inside error messages. Every excerpt
returned or logged is scrubbed of the submitted secrets first.

*Reconnaissance.* The published spec carries fields and labels, not the
verification request. Publishing the exact call the server makes with a
customer's token is free information for an attacker and no benefit to the UI.

*At rest.* Secrets are encrypted with the existing credential-crypto AES-GCM
path before insert.

## D - Denial of service

*Outbound abuse.* Every call goes through `guardedFetch`, so a tenant cannot aim
the platform at link-local or private addresses. This is why a Vault or a
Kubernetes API server on a private network cannot be connected, and the specs
say so rather than letting it look like a credential problem.

*Amplification.* One request per connect. There is no retry loop and no fan-out.

## E - Elevation of privilege

*Cross-tenant.* Every read and write is keyed on `org_id` as well as the key.

*Scope.* The platform cannot constrain what a customer's token can do; that is
the vendor's model. What it can do is not ask for more than it needs, which is
why each spec's verification call is a read-only self or identity endpoint
rather than something that mutates.

## What this gate did NOT clear

Stated so the absence is a decision rather than an omission.

- **Credential rotation and expiry.** There is no scheduled re-verification. A
  token that expires shows as connected until someone presses Verify. The
  endpoint exists; the schedule does not.
- **Least-privilege enforcement.** Nothing checks that a supplied token is
  read-only. A customer can paste an admin token and the platform will accept it.
  The field help says what scope is needed; it cannot verify the customer
  listened.
- **Per-tenant egress controls.** guardedFetch blocks private ranges. It does not
  restrict which public hosts a tenant may cause the platform to call.
- **Secrets in vendor logs.** The customer's own vendor will log that this
  platform authenticated. Out of scope and out of reach.

## Rollout order

1. Registry, engine, redaction and UI - this change. No schema migration, so no
   rollback script: the reverse is a revert.
2. Wire the 16 existing provider modules for evidence collection, and change each
   to read its credentials through the decrypting accessor rather than from
   plaintext config.
3. Scheduled re-verification, so an expired credential surfaces without a human.
4. Per-connector scope documentation in the field help, from each vendor's docs.
