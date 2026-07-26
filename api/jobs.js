import { createJobForBusiness, listJobsForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const jobs = await listJobsForBusiness(session.businessId);
      return res.status(200).json({ ok: true, jobs });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load jobs' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { job } = req.body ?? {};
    if (!job || typeof job !== 'object' || typeof job.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createJobForBusiness({ businessId: session.businessId, job });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create job' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
