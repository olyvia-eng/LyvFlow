import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Modal, Input, TextArea, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '../../utils';
import { formatNumericDisplayValue, parseNumericInputValue } from '../../utils/numberInput';
import type { EstimateTemplate } from '../../types';
import EstimateLineItemEditor from './EstimateLineItemEditor';

const empty = (): Omit<EstimateTemplate, 'id' | 'createdAt'> => ({
  name: '',
  description: '',
  lineItems: [],
  taxRate: 13,
  notes: '',
});

export default function TemplatesPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateTemplate | null>(null);
  const [form, setForm] = useState(empty());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (t: EstimateTemplate) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description, lineItems: t.lineItems.map((li) => ({ ...li })), taxRate: t.taxRate, notes: t.notes });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) updateTemplate(editing.id, form);
    else addTemplate(form);
    setModalOpen(false);
  };

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Estimate Templates"
        subtitle="Reusable templates for common job types."
        action={<Button onClick={openNew}><Plus size={16} /> New Template</Button>}
      />

      {templates.length === 0 ? (
        <EmptyState title="No templates yet" action={<Button onClick={openNew}><Plus size={16} /> New Template</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <p className="font-semibold text-gray-900">{t.name}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
              <p className="text-xs text-gray-400 mt-2">{t.lineItems.length} line items · Created {formatDate(t.createdAt)}</p>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <Button variant="secondary" size="sm" onClick={() => openEdit(t)}><Pencil size={13} /> Edit</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(t.id)}><Trash2 size={13} /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Template' : 'New Template'} wide
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Template</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label="Template Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <TextArea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Default Line Items</p>
            <EstimateLineItemEditor items={form.lineItems as import('../../types').LineItem[]} onChange={(items) => set('lineItems', items)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Default Tax Rate (%)</label>
            <input type="text" inputMode="decimal" min={0} max={100} value={formatNumericDisplayValue(form.taxRate)}
              onChange={(e) => set('taxRate', parseNumericInputValue(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <TextArea label="Default Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Template"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteTemplate(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
        </>}
      >
        <p className="text-gray-600">Delete this template? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
