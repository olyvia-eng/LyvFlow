import {
  deleteCustomerForBusiness,
  getCustomerForBusiness,
  updateCustomerForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const customerId = req.query.id;
  if (typeof customerId !== 'string' || !customerId) {
    return res.status(400).json({ ok: false, error: 'Invalid customer id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getCustomerForBusiness(session.businessId, customerId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Customer not found' });
      }

      const next = {
        ...existing,
        ...data,
      };

      await updateCustomerForBusiness({ businessId: session.businessId, customer: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update customer' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteCustomerForBusiness(session.businessId, customerId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete customer' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
