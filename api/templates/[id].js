import {
  deleteTemplateForBusiness,
  getTemplateForBusiness,
  updateTemplateForBusiness,
} from '../_lib/authRepo.js';
import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const templateId = req.query.id;
  if (typeof templateId !== 'string' || !templateId) {
    return res.status(400).json({ ok: false, error: 'Invalid template id' });
  }

  if (req.method === 'PATCH') {
    const { data } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await getTemplateForBusiness(session.businessId, templateId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Template not found' });
      }

      const next = { ...existing, ...data };
      await updateTemplateForBusiness({ businessId: session.businessId, template: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not update template' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteTemplateForBusiness(session.businessId, templateId);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not delete template' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
