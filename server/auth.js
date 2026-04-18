// Validates the x-ms-client-principal header injected by Azure App Service
// Easy Auth. When Easy Auth is configured with "Require authentication",
// unauthenticated requests never reach this process, but we still verify
// the header defensively (defense in depth) and expose the decoded principal.
//
// Local development: set ALLOW_UNAUTHENTICATED=true to bypass the check.

const ALLOW_UNAUTHENTICATED = process.env.ALLOW_UNAUTHENTICATED === 'true';

function decodeClientPrincipal(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }
  try {
    const json = Buffer.from(headerValue, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extract and validate the authenticated principal from request headers.
 * @param {import('http').IncomingHttpHeaders} headers
 * @returns {{ ok: true, principal: object | null } | { ok: false, reason: string }}
 */
export function verifyClientPrincipal(headers) {
  const raw = headers['x-ms-client-principal'];
  const principal = decodeClientPrincipal(raw);

  if (!principal) {
    if (ALLOW_UNAUTHENTICATED) {
      return { ok: true, principal: null };
    }
    return { ok: false, reason: 'Missing or invalid x-ms-client-principal header' };
  }

  // Sanity check: Easy Auth populates userId / userDetails / identityProvider
  if (!principal.userId && !principal.userDetails && !principal.claims) {
    return { ok: false, reason: 'Client principal payload is empty' };
  }

  return { ok: true, principal };
}

/**
 * Express middleware that rejects requests lacking a valid Easy Auth principal.
 */
export function requireClientPrincipal(req, res, next) {
  const result = verifyClientPrincipal(req.headers);
  if (!result.ok) {
    return res.status(401).json({ success: false, error: result.reason });
  }
  req.clientPrincipal = result.principal;
  next();
}
