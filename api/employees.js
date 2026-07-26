import { createEmployeeForBusiness, listEmployeesForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const employees = await listEmployeesForBusiness(session.businessId);
      return res.status(200).json({ ok: true, employees });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load employees' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { employee } = req.body ?? {};
    if (!employee || typeof employee !== 'object' || typeof employee.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createEmployeeForBusiness({ businessId: session.businessId, employee });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create employee' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
