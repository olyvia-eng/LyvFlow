import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Badge, Modal, Input, Select, TextArea, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, Send, RefreshCw, FileText } from 'lucide-react';
import { statusColor, formatCurrency, formatDate, calcEstimateSubtotal, calcEstimateTax, calcEstimateTotal, generateId } from '../../utils';
import type { Estimate, EstimateStatus, LineItem } from '../../types';
import EstimateLineItemEditor from './EstimateLineItemEditor';

const STATUSES: EstimateStatus[] = ['draft', 'sent', 'accepted', 'declined', 'converted'];

const emptyEstimate = (): Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> => ({
  customerId: '',
  title: '',
  description: '',
  status: 'draft',
  lineItems: [],
  taxRate: 13,
  notes: '',
  validUntil: '',
});

export default function EstimatesPage() {
  const { estimates, customers, templates, addEstimate, updateEstimate, deleteEstimate, sendEstimate, convertEstimateToJob } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [form, setForm] = useState(emptyEstimate());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const filtered = estimates.filter((e) => {
    const customer = customers.find((c) => c.id === e.customerId);
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (customer?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyEstimate());
    setModalOpen(true);
  };

  const openEdit = (e: Estimate) => {
    setEditing(e);
    setForm({
      customerId: e.customerId, title: e.title, description: e.description,
      status: e.status, lineItems: e.lineItems.map((li) => ({ ...li })),
      taxRate: e.taxRate, notes: e.notes, validUntil: e.validUntil,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.customerId) return;
    if (editing) {
      updateEstimate(editing.id, form);
    } else {
      addEstimate(form);
    }
    setModalOpen(false);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const lineItems: LineItem[] = tpl.lineItems.map((li) => ({ ...li, id: generateId() }));
    setForm((f) => ({ ...f, lineItems, taxRate: tpl.taxRate, notes: tpl.notes, templateId }));
    setShowTemplates(false);
  };

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const subtotal = calcEstimateSubtotal(form.lineItems);
  const tax = calcEstimateTax(subtotal, form.taxRate);
  const total = calcEstimateTotal(subtotal, tax);

  return (
    <div>
      <PageHeader
        title="Estimates"
        subtitle="Create and manage estimates for your customers."
        action={<Button onClick={openNew}><Plus size={16} /> New Estimate</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search estimates…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EstimateStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No estimates found" action={<Button onClick={openNew}><Plus size={16} /> New Estimate</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-left">
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium">Valid Until</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((est) => {
                const customer = customers.find((c) => c.id === est.customerId);
                const sub = calcEstimateSubtotal(est.lineItems);
                const ttl = calcEstimateTotal(sub, calcEstimateTax(sub, est.taxRate));
                return (
                  <tr key={est.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{est.title}</td>
                    <td className="py-3 text-gray-600">{customer?.name ?? '—'}</td>
                    <td className="py-3">
                      <Badge label={est.status} className={statusColor[est.status]} />
                    </td>
                    <td className="py-3 text-right font-semibold">{formatCurrency(ttl)}</td>
                    <td className="py-3 text-gray-500">{est.validUntil ? formatDate(est.validUntil) : '—'}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(est)} title="Edit">
                          <Pencil size={13} />
                        </Button>
                        {est.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => sendEstimate(est.id)} title="Mark as Sent">
                            <Send size={13} />
                          </Button>
                        )}
                        {(est.status === 'accepted' || est.status === 'sent') && (
                          <Button variant="ghost" size="sm" onClick={() => setConfirmConvert(est.id)} title="Convert to Job">
                            <RefreshCw size={13} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(est.id)} title="Delete">
                          <Trash2 size={13} className="text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Estimate' : 'New Estimate'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Estimate</Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Template selector */}
          {!editing && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowTemplates((v) => !v)}>
                <FileText size={14} /> Use Template
              </Button>
              {showTemplates && (
                <select
                  autoFocus
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  <option value="">— Select template —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Customer *"
              value={form.customerId}
              onChange={(e) => set('customerId', e.target.value)}
            >
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </Select>
            <Input label="Title *" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <TextArea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />

          {/* Line items */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Line Items</p>
            <EstimateLineItemEditor
              items={form.lineItems}
              onChange={(items) => set('lineItems', items)}
            />
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500">Tax Rate (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.taxRate}
                onChange={(e) => set('taxRate', Number(e.target.value))}
                className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1 mt-1">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valid Until"
              type="date"
              value={form.validUntil ? form.validUntil.slice(0, 10) : ''}
              onChange={(e) => set('validUntil', e.target.value ? new Date(e.target.value).toISOString() : '')}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set('status', e.target.value as EstimateStatus)}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </div>
          <TextArea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Estimate"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteEstimate(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
        </>}>
        <p className="text-gray-600">Delete this estimate? This cannot be undone.</p>
      </Modal>

      {/* Convert confirm */}
      <Modal open={!!confirmConvert} onClose={() => setConfirmConvert(null)} title="Convert to Job"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmConvert(null)}>Cancel</Button>
          <Button onClick={() => { convertEstimateToJob(confirmConvert!); setConfirmConvert(null); }}>Convert</Button>
        </>}>
        <p className="text-gray-600">This will create a new Job from this estimate and mark the estimate as Converted.</p>
      </Modal>
    </div>
  );
}
