import {
  deleteJobForBusiness,
  getJobForBusiness,
  updateJobForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const jobId = req.query.id;
  if (typeof jobId !== 'string' || !jobId) {
    return res.status(400).json({ ok: false, error: 'Invalid job id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getJobForBusiness(session.businessId, jobId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Job not found' });
      }

      const next = {
        ...existing,
        ...data,
      };

      await updateJobForBusiness({ businessId: session.businessId, job: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update job' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteJobForBusiness(session.businessId, jobId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete job' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
