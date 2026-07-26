import {
  deleteBudgetItemForBusiness,
  getBudgetItemForBusiness,
  updateBudgetItemForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const budgetItemId = req.query.id;
  if (typeof budgetItemId !== 'string' || !budgetItemId) {
    return res.status(400).json({ ok: false, error: 'Invalid budget item id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getBudgetItemForBusiness(session.businessId, budgetItemId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Budget item not found' });
      }

      const next = { ...existing, ...data };
      await updateBudgetItemForBusiness({ businessId: session.businessId, budgetItem: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update budget item' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteBudgetItemForBusiness(session.businessId, budgetItemId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete budget item' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
