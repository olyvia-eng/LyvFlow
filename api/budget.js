import { createBudgetItemForBusiness, listBudgetItemsForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const budgetItems = await listBudgetItemsForBusiness(session.businessId);
      return res.status(200).json({ ok: true, budgetItems });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load budget items' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { budgetItem } = req.body ?? {};
    if (!budgetItem || typeof budgetItem !== 'object' || typeof budgetItem.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createBudgetItemForBusiness({ businessId: session.businessId, budgetItem });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create budget item' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
