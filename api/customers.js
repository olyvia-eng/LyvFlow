import {
  createCustomerForBusiness,
  listCustomersForBusiness,
} from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const customers = await listCustomersForBusiness(session.businessId);
      return res.status(200).json({ ok: true, customers });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load customers' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { customer } = req.body ?? {};
    if (!customer || typeof customer !== 'object' || typeof customer.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createCustomerForBusiness({ businessId: session.businessId, customer });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create customer' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
