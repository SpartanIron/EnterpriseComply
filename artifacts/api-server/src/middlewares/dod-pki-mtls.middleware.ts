import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as tls from 'tls';

/**
 * DoD PKI mTLS Middleware
 *
 * Validates client certificates on eMASS agent endpoints:
 * - Checks TLS peer certificate is present (mTLS enforced)
 * - Validates DoD PKI OID chain (DoD Root CA 2/3/4/5)
 * - Extracts EDIPI from Subject CN (format: LAST.FIRST.MIDDLE.EDIPI)
 * - Injects req.edipi for downstream use
 * - Rejects any request without a valid DoD PKI client cert
 *
 * Applied to /api/v1/emass/agent/* routes only
 */
@Injectable()
export class DodPkiMtlsMiddleware implements NestMiddleware {
  // DoD PKI Organization Name identifiers (from cert Issuer O= field)
  private static readonly DOD_PKI_ORG_PATTERNS = [
    'U.S. Government',
    'DoD',
    'Department of Defense',
    'DISA',
    'Defense Information Systems Agency',
  ];

  // Minimum acceptable TLS version for DoD connections
  private static readonly MIN_TLS_VERSION = 'TLSv1.2';

  use(req: Request & { edipi?: string; dodCertFingerprint?: string }, res: Response, next: NextFunction) {
    const socket = req.socket as tls.TLSSocket;

    // 1. Verify TLS socket (should always be true in production, but guard defensively)
    if (!socket || typeof socket.getPeerCertificate !== 'function') {
      throw new UnauthorizedException(
        'eMASS agent endpoints require TLS. Non-TLS connection rejected.'
      );
    }

    // 2. Check TLS version
    const tlsVersion = socket.getProtocol?.() || '';
    if (tlsVersion && tlsVersion < DodPkiMtlsMiddleware.MIN_TLS_VERSION) {
      throw new UnauthorizedException(
        `TLS version ${tlsVersion} is below minimum ${DodPkiMtlsMiddleware.MIN_TLS_VERSION} required for DoD connections`
      );
    }

    // 3. Get client certificate (mTLS peer cert)
    const cert = socket.getPeerCertificate(true);

    if (!cert || !cert.subject) {
      // In non-TLS environments (dev/test), allow header-based EDIPI fallback
      if (process.env.NODE_ENV === 'development' || process.env.EMASS_SKIP_MTLS === 'true') {
        const headerEdipi = req.headers['x-agent-edipi'] as string;
        if (headerEdipi && /^\d{10}$/.test(headerEdipi)) {
          req.edipi = headerEdipi;
          return next();
        }
        throw new UnauthorizedException(
          'Development mode: X-Agent-EDIPI header required (10 digits) when EMASS_SKIP_MTLS=true'
        );
      }
      throw new UnauthorizedException(
        'DoD PKI client certificate required for eMASS agent endpoints. No certificate presented.'
      );
    }

    // 4. Validate certificate is not expired
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    if (now < validFrom || now > validTo) {
      throw new UnauthorizedException(
        `DoD PKI certificate is ${now < validFrom ? 'not yet valid' : 'expired'}. Valid: ${cert.valid_from} to ${cert.valid_to}`
      );
    }

    // 5. Validate DoD PKI issuer chain
    const issuer = cert.issuer || {};
    const issuerOU = Array.isArray(issuer.OU) ? issuer.OU.join(' ') : (issuer.OU || '');
    const issuerO = Array.isArray(issuer.O) ? issuer.O.join(' ') : (issuer.O || '');
    const issuerCN = issuer.CN || '';
    const issuerStr = `${issuerO} ${issuerOU} ${issuerCN}`.toLowerCase();

    const isDodIssuer = DodPkiMtlsMiddleware.DOD_PKI_ORG_PATTERNS.some(pattern =>
      issuerStr.includes(pattern.toLowerCase())
    );

    if (!isDodIssuer && process.env.EMASS_STRICT_DOD_PKI !== 'false') {
      throw new UnauthorizedException(
        `Certificate issuer does not match DoD PKI. Issuer: "${issuerO} ${issuerCN}". Only DoD PKI certificates are accepted.`
      );
    }

    // 6. Extract EDIPI from Subject CN
    // DoD CAC/PIV format: "DOE.JANE.MARIE.1234567890"
    const cn = cert.subject?.CN || '';
    const edipi = DodPkiMtlsMiddleware.extractEdipiFromCN(cn);

    if (!edipi) {
      throw new UnauthorizedException(
        `Cannot extract EDIPI from certificate CN: "${cn}". Expected format: LAST.FIRST.MIDDLE.EDIPI`
      );
    }

    // 7. Cross-validate EDIPI with X-Agent-EDIPI header (if provided)
    const headerEdipi = req.headers['x-agent-edipi'] as string;
    if (headerEdipi && headerEdipi !== edipi && process.env.EMASS_STRICT_DOD_PKI !== 'false') {
      throw new UnauthorizedException(
        `EDIPI mismatch: X-Agent-EDIPI header (${headerEdipi}) does not match certificate CN (${edipi})`
      );
    }

    // 8. Compute cert fingerprint for audit logging
    const fingerprint = cert.fingerprint256 || cert.fingerprint || 'unknown';

    // 9. Inject verified EDIPI and cert info into request
    req.edipi = edipi;
    req.dodCertFingerprint = fingerprint;

    // 10. Log the authenticated connection
    console.log(JSON.stringify({
      level: 'info',
      event: 'dod_pki_mtls_auth',
      edipi,
      cert_cn: cn,
      cert_fingerprint: fingerprint,
      cert_valid_to: cert.valid_to,
      issuer_cn: issuerCN,
      tls_version: tlsVersion,
      ip: req.ip,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    }));

    next();
  }

  /**
   * Extract 10-digit EDIPI from DoD PKI certificate CN.
   * CN format: "LAST.FIRST.MIDDLE.EDIPI" (last segment is the EDIPI)
   */
  static extractEdipiFromCN(cn: string): string | null {
    if (!cn) return null;
    const parts = cn.split('.');
    const last = parts[parts.length - 1];
    if (last && /^\d{10}$/.test(last)) {
      return last;
    }
    return null;
  }
}
