import {
  deleteAuthUserForBusinessByEmail,
  deleteEmployeeForBusiness,
  getEmployeeForBusiness,
  updateEmployeeForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const employeeId = req.query.id;
  if (typeof employeeId !== 'string' || !employeeId) {
    return res.status(400).json({ ok: false, error: 'Invalid employee id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getEmployeeForBusiness(session.businessId, employeeId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Employee not found' });
      }

      const next = { ...existing, ...data };
      await updateEmployeeForBusiness({ businessId: session.businessId, employee: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update employee' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const existing = await getEmployeeForBusiness(session.businessId, employeeId);
      if (existing?.email) {
        const authDelete = await deleteAuthUserForBusinessByEmail(session.businessId, existing.email);
        if (!authDelete.ok) {
          return res.status(409).json({ ok: false, error: authDelete.error });
        }
      }

      await deleteEmployeeForBusiness(session.businessId, employeeId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete employee' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
