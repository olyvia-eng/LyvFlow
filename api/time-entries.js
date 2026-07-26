import { createTimeEntryForBusiness, listTimeEntriesForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const timeEntries = await listTimeEntriesForBusiness(session.businessId);
      return res.status(200).json({ ok: true, timeEntries });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load time entries' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;

    const { timeEntry } = req.body ?? {};
    if (!timeEntry || typeof timeEntry !== 'object' || typeof timeEntry.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createTimeEntryForBusiness({ businessId: session.businessId, timeEntry });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create time entry' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
