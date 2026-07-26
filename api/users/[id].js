import {
  deleteBusinessUser,
  getBusinessUserById,
  updateBusinessUser,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const userId = req.query.id;
  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ ok: false, error: 'Invalid user id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getBusinessUserById(session.businessId, userId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      if (existing.role === 'owner' && data.role && data.role !== 'owner') {
        return res.status(409).json({ ok: false, error: 'Owner role cannot be changed.' });
      }

      const next = { ...existing, ...data };
      const result = await updateBusinessUser({ businessId: session.businessId, user: next });
      if (!result.ok) {
        return res.status(409).json({ ok: false, error: result.error });
      }

      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update user' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await deleteBusinessUser(session.businessId, userId);
      if (!result.ok) {
        return res.status(409).json({ ok: false, error: result.error });
      }

      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete user' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
