import {
  deleteEstimateForBusiness,
  getEstimateForBusiness,
  updateEstimateForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const estimateId = req.query.id;
  if (typeof estimateId !== 'string' || !estimateId) {
    return res.status(400).json({ ok: false, error: 'Invalid estimate id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getEstimateForBusiness(session.businessId, estimateId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Estimate not found' });
      }

      const next = { ...existing, ...data };
      await updateEstimateForBusiness({ businessId: session.businessId, estimate: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update estimate' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteEstimateForBusiness(session.businessId, estimateId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete estimate' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
