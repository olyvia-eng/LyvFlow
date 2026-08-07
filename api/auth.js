import { authenticateUser, createBusinessWithOwner } from './_lib/authRepo.js';
import { buildClearedSessionCookie, buildSessionCookie } from './_lib/cookies.js';
import {
  createSessionToken,
  getSessionFromRequest,
  getBearerTokenFromRequest,
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
} from './_lib/session.js';
import {
  createMobileSessionForUser,
  revokeMobileSessionByAccessToken,
} from './_lib/authRepo.js';
import { randomBytes } from 'node:crypto';

function createMobileAccessToken() {
  return `oliveops_mobile_${randomBytes(32).toString('base64url')}`;
}

const defaultDeps = {
  authenticateUser,
  createBusinessWithOwner,
  createSessionToken,
  getSessionFromRequest,
  getBearerTokenFromRequest,
  createMobileSessionForUser,
  revokeMobileSessionByAccessToken,
  buildSessionCookie,
  buildClearedSessionCookie,
  createMobileAccessToken,
  mobileAccessTokenTtlSeconds: MOBILE_ACCESS_TOKEN_TTL_SECONDS,
};

export function createAuthHandler(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };

  return async function handler(req, res) {
    const action = req.query.action;

    if (action === 'session') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const session = await deps.getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      return res.status(200).json({ ok: true, user: session });
    }

    if (action === 'logout') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const bearerToken = deps.getBearerTokenFromRequest(req);
      if (bearerToken) {
        try {
          await deps.revokeMobileSessionByAccessToken(bearerToken);
        } catch {
          return res.status(500).json({ ok: false, error: 'Logout failed' });
        }
      }

      res.setHeader('Set-Cookie', deps.buildClearedSessionCookie());
      return res.status(200).json({ ok: true });
    }

    if (action === 'login') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }

      try {
        const result = await deps.authenticateUser(email, password);
        if (!result.ok) {
          return res.status(401).json({ ok: false, error: result.error });
        }

        const token = deps.createSessionToken(result.user);
        res.setHeader('Set-Cookie', deps.buildSessionCookie(token));
        return res.status(200).json({ ok: true, user: result.user });
      } catch {
        return res.status(500).json({ ok: false, error: 'Login failed' });
      }
    }

    if (action === 'mobile-login') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }

      try {
        const result = await deps.authenticateUser(email, password);
        if (!result.ok) {
          return res.status(401).json({ ok: false, error: result.error });
        }

        const accessToken = deps.createMobileAccessToken();
        await deps.createMobileSessionForUser({
          user: result.user,
          accessToken,
          expiresInSeconds: deps.mobileAccessTokenTtlSeconds,
        });

        return res.status(200).json({
          ok: true,
          accessToken,
          tokenType: 'Bearer',
          expiresIn: deps.mobileAccessTokenTtlSeconds,
          user: result.user,
        });
      } catch {
        return res.status(500).json({ ok: false, error: 'Mobile login failed' });
      }
    }

    if (action === 'signup') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const { businessName, ownerName, email, password } = req.body ?? {};
      if (
        typeof businessName !== 'string' ||
        typeof ownerName !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string'
      ) {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }

      if (!businessName.trim() || !ownerName.trim() || !email.trim() || password.length < 8) {
        return res.status(400).json({ ok: false, error: 'Invalid signup fields' });
      }

      try {
        const result = await deps.createBusinessWithOwner({ businessName, ownerName, email, password });
        if (!result.ok) {
          return res.status(409).json({ ok: false, error: result.error });
        }

        const token = deps.createSessionToken(result.user);
        res.setHeader('Set-Cookie', deps.buildSessionCookie(token));
        return res.status(200).json({ ok: true, user: result.user });
      } catch {
        return res.status(500).json({ ok: false, error: 'Signup failed' });
      }
    }

    return res.status(400).json({ ok: false, error: 'Invalid auth action' });
  };
}

export default createAuthHandler();
