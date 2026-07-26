import {
  createUserForBusiness,
  listUsersForBusiness,
} from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    try {
      const users = await listUsersForBusiness(session.businessId);
      return res.status(200).json({ ok: true, users });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load users' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { name, email, password, role } = req.body ?? {};
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      (role !== 'admin' && role !== 'employee')
    ) {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    if (!name.trim() || !email.trim() || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Invalid user fields' });
    }

    try {
      const result = await createUserForBusiness({
        businessId: session.businessId,
        name,
        email,
        password,
        role,
      });

      if (!result.ok) {
        return res.status(409).json({ ok: false, error: result.error });
      }

      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create user' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
