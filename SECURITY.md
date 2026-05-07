# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Email security@colorcodesolutions.com with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation (if any)

We will acknowledge your report within 48 hours and provide a detailed response within 7 business days. If the vulnerability is confirmed, we aim to release a patch within 30 days.

## Security Architecture

**Authentication and Authorization**
- All authentication is handled via Clerk (SOC 2 Type II certified)
- Every authenticated API route requires a valid Clerk session token
- Multi-tenant data isolation enforced at the database level - every table has `org_id`, and all queries are scoped by organization

**API Security**
- Security headers enforced via Helmet.js (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Rate limiting on all API endpoints (120 requests per minute per IP)
- CORS restricted to same origin in production; configurable via `ALLOWED_ORIGIN`
- All input validated via Zod schemas before processing

**Data Security**
- SQL injection prevention via Drizzle ORM parameterized queries
- Secrets managed exclusively via environment variables (never committed to source)
- HTTPS enforced in production via Railway TLS termination
- Database credentials never exposed to the frontend

**Dependency Management**
- Automated dependency auditing via `pnpm audit` in CI
- CI pipeline runs on every pull request and push to main

## Disclosure Policy

We follow a coordinated disclosure model. Please give us reasonable time to address the issue before public disclosure.
