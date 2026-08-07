import bcrypt from 'bcryptjs';
import { getBusinessUserById, updateBusinessUser } from './_lib/authRepo.js';
import { buildSessionCookie } from './_lib/cookies.js';
import { createSessionToken, requireSession } from './_lib/session.js';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const { name, email, password } = req.body ?? {};

  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid name.' });
  }

  if (email !== undefined && typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid email.' });
  }

  if (password !== undefined && typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid password.' });
  }

  if (password && password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await getBusinessUserById(session.businessId, session.id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    const nextName = (name ?? existing.name).trim();
    const nextEmail = normalizeEmail(email ?? existing.email);

    if (!nextName) {
      return res.status(400).json({ ok: false, error: 'Name is required.' });
    }

    if (!nextEmail) {
      return res.status(400).json({ ok: false, error: 'Email is required.' });
    }

    const nextPasswordHash = password
      ? await bcrypt.hash(password, 10)
      : existing.passwordHash;

    const result = await updateBusinessUser({
      businessId: session.businessId,
      user: {
        id: existing.id,
        name: nextName,
        email: nextEmail,
        role: existing.role,
        active: existing.active,
        createdAt: existing.createdAt,
        passwordHash: nextPasswordHash,
      },
    });

    if (!result.ok) {
      return res.status(409).json({ ok: false, error: result.error ?? 'Could not update profile.' });
    }

    const updatedSessionUser = {
      id: existing.id,
      businessId: session.businessId,
      name: nextName,
      email: nextEmail,
      role: existing.role,
      businessName: session.businessName,
    };

    const token = createSessionToken(updatedSessionUser);
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(200).json({ ok: true, user: updatedSessionUser });
  } catch {
    return res.status(500).json({ ok: false, error: 'Could not update profile.' });
  }
}
