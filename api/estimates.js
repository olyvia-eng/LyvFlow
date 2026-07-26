import { createEstimateForBusiness, listEstimatesForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const estimates = await listEstimatesForBusiness(session.businessId);
      return res.status(200).json({ ok: true, estimates });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load estimates' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { estimate } = req.body ?? {};
    if (!estimate || typeof estimate !== 'object' || typeof estimate.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createEstimateForBusiness({ businessId: session.businessId, estimate });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create estimate' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
