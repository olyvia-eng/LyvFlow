import { buildSessionCookie } from '../_lib/cookies.js';
import { createBusinessWithOwner } from '../_lib/authRepo.js';
import { createSessionToken } from '../_lib/session.js';

export default async function handler(req, res) {
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
    const result = await createBusinessWithOwner({
      businessName,
      ownerName,
      email,
      password,
    });

    if (!result.ok) {
      return res.status(409).json({ ok: false, error: result.error });
    }

    const token = createSessionToken(result.user);
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(200).json({
      ok: true,
      user: result.user,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Signup failed' });
  }
}
