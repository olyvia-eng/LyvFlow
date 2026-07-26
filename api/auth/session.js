import { getSessionFromRequest } from '../_lib/session.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  return res.status(200).json({ ok: true, user: session });
}
