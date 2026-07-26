import {
  deleteTimeEntryForBusiness,
  getTimeEntryForBusiness,
  updateTimeEntryForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  const entryId = req.query.id;
  if (typeof entryId !== 'string' || !entryId) {
    return res.status(400).json({ ok: false, error: 'Invalid time entry id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getTimeEntryForBusiness(session.businessId, entryId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Time entry not found' });
      }

      const next = { ...existing, ...data };
      await updateTimeEntryForBusiness({ businessId: session.businessId, timeEntry: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update time entry' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteTimeEntryForBusiness(session.businessId, entryId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete time entry' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
