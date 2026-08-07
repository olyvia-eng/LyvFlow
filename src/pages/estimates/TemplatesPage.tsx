import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Modal, Input, TextArea, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate, generateId } from '../../utils';
import { formatNumericDisplayValue, parseNumericInputValue } from '../../utils/numberInput';
import { flattenWorkAreaLineItems, normalizeTemplateWorkAreas } from '../../utils/estimateModel';
import type { EstimateLineItem, EstimateTemplate, EstimateWorkArea } from '../../types';
import EstimateLineItemEditor from './EstimateLineItemEditor';

type TemplateFormState = Omit<EstimateTemplate, 'id' | 'createdAt' | 'lineItems'> & {
  workAreas: EstimateWorkArea[];
};

const empty = (): TemplateFormState => ({
  name: '',
  description: '',
  workAreas: [],
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
    const workAreas = normalizeTemplateWorkAreas(t);
    setEditing(t);
    setForm({ name: t.name, description: t.description, workAreas, taxRate: t.taxRate, notes: t.notes });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      workAreas: form.workAreas,
      lineItems: flattenWorkAreaLineItems(form.workAreas),
    };
    if (editing) updateTemplate(editing.id, payload);
    else addTemplate(payload);
    setModalOpen(false);
  };

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addWorkArea = () => {
    setForm((previous) => ({
      ...previous,
      workAreas: [
        ...previous.workAreas,
        {
          id: generateId(),
          name: `Work Area ${previous.workAreas.length + 1}`,
          description: '',
          sortOrder: previous.workAreas.length,
          lineItems: [],
        },
      ],
    }));
  };

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
              <p className="text-xs text-gray-400 mt-2">{normalizeTemplateWorkAreas(t).length} work areas · Created {formatDate(t.createdAt)}</p>
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
          <Input label="Template Name *" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <TextArea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Work Areas</p>
              <Button variant="secondary" size="sm" onClick={addWorkArea}><Plus size={14} /> Add Work Area</Button>
            </div>
            {form.workAreas.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No work areas yet.</p>
            ) : form.workAreas.map((workArea) => (
              <div key={workArea.id} className="rounded-lg border border-gray-200 p-3 bg-white mb-3 space-y-2">
                <Input
                  label="Area Name"
                  value={workArea.name}
                  onChange={(e) => set('workAreas', form.workAreas.map((value) => value.id === workArea.id ? { ...value, name: e.target.value } : value))}
                />
                <TextArea
                  label="Area Description"
                  value={workArea.description}
                  onChange={(e) => set('workAreas', form.workAreas.map((value) => value.id === workArea.id ? { ...value, description: e.target.value } : value))}
                />
                <EstimateLineItemEditor
                  items={workArea.lineItems}
                  onChange={(items: EstimateLineItem[]) => set('workAreas', form.workAreas.map((value) => value.id === workArea.id ? { ...value, lineItems: items } : value))}
                />
              </div>
            ))}
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
