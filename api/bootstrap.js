import { listCustomersForBusiness, listJobsForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = requireSession(req, res);
  if (!session) return;

  try {
    const [customers, jobs] = await Promise.all([
      listCustomersForBusiness(session.businessId),
      listJobsForBusiness(session.businessId),
    ]);

    return res.status(200).json({ ok: true, customers, jobs });
  } catch {
    return res.status(500).json({ ok: false, error: 'Could not load business data' });
  }
}
