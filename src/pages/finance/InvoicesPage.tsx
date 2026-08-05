import { useMemo, useState } from 'react';
import { FilePlus2, Mail, Pencil, ReceiptText, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard } from '../../components/ui';
import { useStore } from '../../store';
import { emitAppToast } from '../../toast';
import { formatCurrency } from '../../utils';
import type { ID, Invoice, InvoiceStatus } from '../../types';

type StatusFilter = 'all' | InvoiceStatus;

const statusBadgeClass: Record<InvoiceStatus, string> = {
  draft: 'bg-brand-100 text-brand-700',
  sent: 'bg-accent-50 text-accent-600',
  paid: 'bg-brand-200 text-brand-800',
  overdue: 'bg-accent-100 text-accent-700',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

const emptyInvoiceForm = () => ({
  jobId: '',
  number: '',
  issueDate: todayIso(),
  dueDate: defaultDueDate(),
  status: 'draft' as InvoiceStatus,
  amount: 0,
  notes: '',
});

function normalizeStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'draft') return 'draft';

  const due = new Date(invoice.dueDate);
  const now = new Date();
  if (invoice.status === 'sent' && due < now) return 'overdue';
  return invoice.status;
}

export default function InvoicesPage() {
  const { jobs, customers, invoices, addInvoice, updateInvoice, deleteInvoice } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [form, setForm] = useState(emptyInvoiceForm());

  const jobLookup = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const customerLookup = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  const invoicesWithComputedStatus = useMemo(() => {
    return invoices.map((invoice) => ({
      ...invoice,
      status: normalizeStatus(invoice),
    }));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoicesWithComputedStatus;
    return invoicesWithComputedStatus.filter((invoice) => invoice.status === statusFilter);
  }, [invoicesWithComputedStatus, statusFilter]);

  const totals = useMemo(() => {
    const totalBilled = invoicesWithComputedStatus.reduce((sum, invoice) => sum + invoice.amount, 0);
    const outstanding = invoicesWithComputedStatus
      .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const overdue = invoicesWithComputedStatus
      .filter((invoice) => invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    const invoicedByJob = new Map<ID, number>();
    for (const invoice of invoicesWithComputedStatus) {
      invoicedByJob.set(invoice.jobId, (invoicedByJob.get(invoice.jobId) ?? 0) + invoice.amount);
    }

    const completedJobs = jobs.filter((job) => job.status === 'completed');
    const readyToInvoice = completedJobs.reduce((sum, job) => {
      const alreadyInvoiced = invoicedByJob.get(job.id) ?? 0;
      const remaining = Math.max(0, job.contractValue - alreadyInvoiced);
      return sum + remaining;
    }, 0);

    return {
      totalBilled,
      outstanding,
      overdue,
      readyToInvoice,
    };
  }, [invoicesWithComputedStatus, jobs]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyInvoiceForm());
    setModalOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setEditing(invoice);
    setForm({
      jobId: invoice.jobId,
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      amount: invoice.amount,
      notes: invoice.notes,
    });
    setModalOpen(true);
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveInvoice = () => {
    if (!form.jobId || !form.number.trim() || form.amount <= 0) return;
    const normalizedNumber = form.number.trim().toLowerCase();
    const duplicate = invoices.some((invoice) => {
      if (editing && invoice.id === editing.id) return false;
      return invoice.number.trim().toLowerCase() === normalizedNumber;
    });
    if (duplicate) {
      emitAppToast({ tone: 'error', message: 'Invoice number already exists.' });
      return;
    }

    const selectedJob = jobLookup.get(form.jobId);
    if (!selectedJob) return;

    if (editing) {
      updateInvoice(editing.id, {
        jobId: form.jobId,
        customerId: selectedJob.customerId,
        number: form.number.trim(),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        amount: Number(form.amount),
        notes: form.notes.trim(),
      });
    } else {
      addInvoice({
        jobId: form.jobId,
        customerId: selectedJob.customerId,
        number: form.number.trim(),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        amount: Number(form.amount),
        notes: form.notes.trim(),
      });
    }

    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Track what has been billed, what is outstanding, and what should be invoiced next."
        action={<Button onClick={openNew}><FilePlus2 size={16} /> New Invoice</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ready to Invoice" value={formatCurrency(totals.readyToInvoice)} icon={<ReceiptText size={28} />} color="text-brand-700" sub="Completed jobs not fully billed" />
        <StatCard label="Outstanding" value={formatCurrency(totals.outstanding)} icon={<Mail size={28} />} color="text-accent-600" sub="Sent or overdue" />
        <StatCard label="Overdue" value={formatCurrency(totals.overdue)} icon={<Wallet size={28} />} color="text-accent-700" sub="Past due date" />
        <StatCard label="Total Billed" value={formatCurrency(totals.totalBilled)} icon={<ReceiptText size={28} />} color="text-brand-700" sub={`${invoices.length} invoices`} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Invoice Register</h2>
            <p className="text-sm text-gray-500 mt-1">Create, edit, and track invoice status from one place.</p>
          </div>
          <div className="w-full sm:w-56">
            <Select label="Status Filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Create your first invoice to start tracking cash collection."
            action={<Button onClick={openNew}><FilePlus2 size={16} /> New Invoice</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((invoice) => {
                  const job = jobLookup.get(invoice.jobId);
                  const customer = customerLookup.get(invoice.customerId);
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{invoice.number}</td>
                      <td className="px-4 py-2 text-gray-700">{job?.title ?? 'Unknown Job'}</td>
                      <td className="px-4 py-2 text-gray-700">{customer?.name ?? 'Unknown Customer'}</td>
                      <td className="px-4 py-2 text-gray-700">{invoice.issueDate}</td>
                      <td className="px-4 py-2 text-gray-700">{invoice.dueDate}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(invoice.amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass[invoice.status]}`}>
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(invoice)}><Pencil size={13} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteInvoice(invoice.id as ID)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Invoice' : 'New Invoice'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveInvoice}>{editing ? 'Save Changes' : 'Create Invoice'}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Select
            label="Job"
            required
            value={form.jobId}
            onChange={(event) => setField('jobId', event.target.value)}
          >
            <option value="">Select a job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </Select>
          <Input label="Invoice Number" required value={form.number} onChange={(event) => setField('number', event.target.value)} placeholder="e.g. INV-2026-001" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Issue Date" type="date" required value={form.issueDate} onChange={(event) => setField('issueDate', event.target.value)} />
            <Input label="Due Date" type="date" required value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} />
          </div>
          <Input label="Amount" type="number" min={0} required value={form.amount} onChange={(event) => setField('amount', Number(event.target.value))} />
          <Select label="Status" required value={form.status} onChange={(event) => setField('status', event.target.value as InvoiceStatus)}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </Select>
          <Input label="Notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Optional notes" />
        </div>
      </Modal>
    </div>
  );
}
