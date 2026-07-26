import jwt from 'jsonwebtoken';
import { requireEnv } from './env.js';
import { SESSION_COOKIE, parseCookies } from './cookies.js';

const jwtSecret = requireEnv('JWT_SECRET');

export function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      businessId: user.businessId,
      name: user.name,
      email: user.email,
      role: user.role,
      businessName: user.businessName,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (!payload || typeof payload !== 'object') return null;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.businessId !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.businessName !== 'string'
    ) {
      return null;
    }

    return {
      id: payload.sub,
      businessId: payload.businessId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      businessName: payload.businessName,
    };
  } catch {
    return null;
  }
}

export function requireSession(req, res, allowedRoles) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return null;
  }

  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.role)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return null;
  }

  return session;
}
