import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Badge, Modal, Input, Select, TextArea, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, Send, RefreshCw, FileText, FileDown, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { emitAppToast } from '../../toast';
import { statusColor, formatCurrency, formatDate, calcEstimateSubtotal, calcEstimateTax, calcEstimateTotal, generateId } from '../../utils';
import type { Estimate, EstimateStatus, LineItem } from '../../types';
import EstimateLineItemEditor from './EstimateLineItemEditor';
import { formatNumericDisplayValue, parseNumericInputValue } from '../../utils/numberInput';

const STATUSES: EstimateStatus[] = ['draft', 'sent', 'accepted', 'declined', 'converted'];

const emptyEstimate = (): Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> => ({
  customerId: '',
  proposalNumber: '',
  title: '',
  description: '',
  workAreas: [],
  status: 'draft',
  lineItems: [],
  taxRate: 13,
  notes: '',
  validUntil: '',
});

const nextProposalNumber = (estimates: Estimate[]): string => {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;

  const used = new Set(
    estimates
      .map((estimate) => estimate.proposalNumber?.trim().toUpperCase() ?? '')
      .filter((proposalNumber) => proposalNumber.startsWith(prefix))
      .map((proposalNumber) => {
        const sequence = Number(proposalNumber.slice(prefix.length));
        return Number.isFinite(sequence) ? sequence : NaN;
      })
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  let next = 1;
  while (used.has(next)) next += 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

const sanitizeFileNamePart = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const createProposalDocument = (estimate: Estimate, customerName: string, customerCompany?: string) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const subtotal = calcEstimateSubtotal(estimate.lineItems);
  const tax = calcEstimateTax(subtotal, estimate.taxRate);
  const total = calcEstimateTotal(subtotal, tax);
  const generatedAt = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.text('Project Proposal', 40, 44);
  doc.setFontSize(10);
  const hasProposalNumber = Boolean(estimate.proposalNumber?.trim());
  if (hasProposalNumber) {
    doc.text(`Proposal #: ${estimate.proposalNumber?.trim()}`, 40, 64);
  }
  const estimateY = hasProposalNumber ? 78 : 64;
  const customerY = hasProposalNumber ? 92 : 78;
  const generatedY = hasProposalNumber ? 106 : 92;
  const validUntilY = hasProposalNumber ? 120 : 106;
  doc.text(`Estimate: ${estimate.title}`, 40, estimateY);
  doc.text(`Customer: ${customerName}${customerCompany ? ` (${customerCompany})` : ''}`, 40, customerY);
  doc.text(`Generated: ${generatedAt}`, 40, generatedY);
  doc.text(`Valid Until: ${estimate.validUntil ? formatDate(estimate.validUntil) : 'Not specified'}`, 40, validUntilY);

  if (estimate.description?.trim()) {
    doc.setFontSize(11);
    doc.text('Scope', 40, 130);
    doc.setFontSize(10);
    const scopeLines = doc.splitTextToSize(estimate.description.trim(), 530);
    doc.text(scopeLines, 40, 146);
  }

  autoTable(doc, {
    startY: 176,
    head: [['Category', 'Description', 'Qty', 'Unit', 'Unit Cost', 'Markup', 'Line Total']],
    body: estimate.lineItems.map((line) => [
      line.category,
      line.description,
      String(line.quantity),
      line.unit,
      formatCurrency(line.unitCost),
      `${line.markup}%`,
      formatCurrency(line.total),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [97, 110, 86] },
  });

  const tableBottomY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 176;

  autoTable(doc, {
    startY: tableBottomY + 16,
    head: [['Summary', 'Amount']],
    body: [
      ['Subtotal', formatCurrency(subtotal)],
      [`Tax (${estimate.taxRate}%)`, formatCurrency(tax)],
      ['Total', formatCurrency(total)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [134, 143, 122] },
  });

  if (estimate.notes?.trim()) {
    const notesStartY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? tableBottomY) + 20;
    doc.setFontSize(11);
    doc.text('Notes', 40, notesStartY);
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(estimate.notes.trim(), 530);
    doc.text(noteLines, 40, notesStartY + 16);
  }

  return doc;
};

export default function EstimatesPage() {
  const { estimates, customers, templates, addEstimate, updateEstimate, deleteEstimate, sendEstimate, convertEstimateToJob } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [form, setForm] = useState(emptyEstimate());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<string | null>(null);
  const [proposalEstimateId, setProposalEstimateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const proposalEstimate = proposalEstimateId ? estimates.find((estimate) => estimate.id === proposalEstimateId) ?? null : null;
  const proposalCustomer = proposalEstimate ? customers.find((customer) => customer.id === proposalEstimate.customerId) ?? null : null;

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
    setForm({ ...emptyEstimate(), proposalNumber: nextProposalNumber(estimates) });
    setModalOpen(true);
  };

  const openEdit = (e: Estimate) => {
    setEditing(e);
    setForm({
      customerId: e.customerId, proposalNumber: e.proposalNumber ?? '', title: e.title, description: e.description,
      workAreas: [...(e.workAreas ?? [])],
      status: e.status, lineItems: e.lineItems.map((li) => ({ ...li })),
      taxRate: e.taxRate, notes: e.notes, validUntil: e.validUntil,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.customerId) return;
    const proposalNumber = form.proposalNumber?.trim() || nextProposalNumber(estimates);
    const payload = { ...form, proposalNumber };
    if (editing) {
      updateEstimate(editing.id, payload);
    } else {
      addEstimate(payload);
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

  const createProposalPdf = (estimate: Estimate) => {
    const customer = customers.find((value) => value.id === estimate.customerId);
    const customerName = customer?.name?.trim() || 'Client';
    const safeTitle = sanitizeFileNamePart(estimate.title) || 'estimate';
    const safeProposalNumber = sanitizeFileNamePart(estimate.proposalNumber ?? '');
    const fileName = safeProposalNumber
      ? `proposal-${safeProposalNumber}-${safeTitle}.pdf`
      : `proposal-${safeTitle}-${estimate.id.slice(0, 8)}.pdf`;

    const doc = createProposalDocument(estimate, customerName, customer?.company);
    doc.save(fileName);
    emitAppToast({ tone: 'success', message: `Proposal PDF generated: ${fileName}` });
  };

  const sendProposalToClient = (estimate: Estimate) => {
    const customer = customers.find((value) => value.id === estimate.customerId);
    if (!customer?.email?.trim()) {
      emitAppToast({ tone: 'error', message: 'Customer email is missing. Add an email before sending.' });
      return;
    }

    createProposalPdf(estimate);

    const subtotalValue = calcEstimateSubtotal(estimate.lineItems);
    const totalValue = calcEstimateTotal(subtotalValue, calcEstimateTax(subtotalValue, estimate.taxRate));
    const proposalRef = estimate.proposalNumber?.trim();
    const subject = encodeURIComponent(proposalRef ? `Proposal ${proposalRef}: ${estimate.title}` : `Proposal: ${estimate.title}`);
    const body = encodeURIComponent(
      [
        `Hi ${customer.name},`,
        '',
        `Please find attached our proposal for ${estimate.title}.`,
        proposalRef ? `Proposal reference: ${proposalRef}.` : '',
        `Total proposed amount: ${formatCurrency(totalValue)}.`,
        estimate.validUntil ? `This proposal is valid until ${formatDate(estimate.validUntil)}.` : 'This proposal does not have an expiry date listed.',
        '',
        'Thank you,',
      ].join('\n')
    );

    if (typeof window !== 'undefined') {
      window.location.href = `mailto:${encodeURIComponent(customer.email)}?subject=${subject}&body=${body}`;
    }

    if (estimate.status === 'draft') {
      sendEstimate(estimate.id);
    }
    emitAppToast({ tone: 'success', message: 'Email draft opened. Attach the proposal PDF and send.' });
  };

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
            className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 rounded-xl shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EstimateStatus | 'all')}
          className="h-10 border border-gray-300 rounded-xl px-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
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
                <th className="pb-2 font-medium">Work Areas</th>
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
                    <td className="py-3 text-gray-600">{est.workAreas?.length ? est.workAreas.join(', ') : '—'}</td>
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
                        <Button variant="ghost" size="sm" onClick={() => setProposalEstimateId(est.id)} title="Create Proposal PDF">
                          <FileDown size={13} />
                        </Button>
                        {(est.status === 'accepted' || est.status === 'sent') && (
                          <Button variant="ghost" size="sm" onClick={() => setConfirmConvert(est.id)} title="Convert to Job">
                            <RefreshCw size={13} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(est.id)} title="Delete">
                          <Trash2 size={13} className="text-accent-700" />
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
                  className="h-9 border border-gray-300 rounded-xl px-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
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
              required
              value={form.customerId}
              onChange={(e) => set('customerId', e.target.value)}
            >
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </Select>
            <Input
              label="Proposal Number"
              value={form.proposalNumber ?? ''}
              onChange={(e) => set('proposalNumber', e.target.value)}
              placeholder="e.g. PROP-2026-014"
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Input label="Title *" required value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <TextArea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <TextArea
            label="Work Areas"
            value={(form.workAreas ?? []).join('\n')}
            onChange={(e) => set('workAreas', e.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
            placeholder="Front yard\nBack patio\nGarden beds"
          />

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
                type="text"
                inputMode="decimal"
                min={0}
                max={100}
                value={formatNumericDisplayValue(form.taxRate)}
                onChange={(e) => set('taxRate', parseNumericInputValue(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
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

      {/* Proposal modal */}
      <Modal
        open={!!proposalEstimate}
        onClose={() => setProposalEstimateId(null)}
        title="Create Proposal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProposalEstimateId(null)}>Close</Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!proposalEstimate) return;
                createProposalPdf(proposalEstimate);
              }}
            >
              <FileDown size={14} /> Download PDF
            </Button>
            <Button
              onClick={() => {
                if (!proposalEstimate) return;
                sendProposalToClient(proposalEstimate);
              }}
            >
              <Mail size={14} /> Send to Client
            </Button>
          </>
        }
      >
        {proposalEstimate ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p className="text-gray-600">Generate a client-ready proposal PDF for this estimate.</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
              <p><span className="font-medium text-gray-900">Proposal #:</span> {proposalEstimate.proposalNumber?.trim() || 'Not set'}</p>
              <p><span className="font-medium text-gray-900">Estimate:</span> {proposalEstimate.title}</p>
              <p><span className="font-medium text-gray-900">Customer:</span> {proposalCustomer?.name ?? 'Unknown Customer'}</p>
              <p><span className="font-medium text-gray-900">Valid Until:</span> {proposalEstimate.validUntil ? formatDate(proposalEstimate.validUntil) : 'Not specified'}</p>
              <p><span className="font-medium text-gray-900">Total:</span> {formatCurrency(calcEstimateTotal(calcEstimateSubtotal(proposalEstimate.lineItems), calcEstimateTax(calcEstimateSubtotal(proposalEstimate.lineItems), proposalEstimate.taxRate)))}</p>
            </div>
            <p className="text-xs text-gray-500">Send to Client opens your email app with a draft message. Attach the downloaded PDF before sending.</p>
          </div>
        ) : null}
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
