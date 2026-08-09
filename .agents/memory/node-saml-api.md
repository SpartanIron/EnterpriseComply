---
name: @node-saml/node-saml v4 API
description: Correct SamlConfig property names and required fields for @node-saml/node-saml v4.
---

## Rule
Use `idpCert` (not `cert`) for the IdP signing certificate in `SamlConfig`. The config is `Partial<SamlOptions> & MandatorySamlOptions`, and `MandatorySamlOptions` requires: `idpCert`, `issuer`, `callbackUrl`.

Several fields have no default and must be provided explicitly to avoid runtime errors:
- `additionalParams: {}`, `additionalAuthorizeParams: {}`
- `identifierFormat`: must be a string or `null` (not undefined)
- `acceptedClockSkewMs`: number
- `disableRequestedAuthnContext`: boolean
- `cacheProvider`: must implement `{ saveAsync, getAsync, removeAsync }` — use in-memory stubs in a stateless app

**Why:** TypeScript will silently accept the wrong property name at the call site if types are loose; the runtime library will then fail to validate assertions or build the login redirect.

**How to apply:** Reference `lib/saml-sp.ts` for the working `buildSamlInstance()` that passes all required fields.
