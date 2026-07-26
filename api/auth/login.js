import { authenticateUser } from '../_lib/authRepo.js';
import { buildSessionCookie } from '../_lib/cookies.js';
import { createSessionToken } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  try {
    const result = await authenticateUser(email, password);
    if (!result.ok) {
      return res.status(401).json({ ok: false, error: result.error });
    }

    const token = createSessionToken(result.user);
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(200).json({
      ok: true,
      user: result.user,
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
}
