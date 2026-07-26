import { createTemplateForBusiness, listTemplatesForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const templates = await listTemplatesForBusiness(session.businessId);
      return res.status(200).json({ ok: true, templates });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load templates' });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, ['owner', 'admin']);
    if (!session) return;

    const { template } = req.body ?? {};
    if (!template || typeof template !== 'object' || typeof template.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await createTemplateForBusiness({ businessId: session.businessId, template });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not create template' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
