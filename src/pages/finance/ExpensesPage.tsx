import { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, HandCoins, Pencil, Receipt, Wallet, Link as LinkIcon } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard } from '../../components/ui';
import { useStore } from '../../store';
import { formatCurrency } from '../../utils';
import { uploadFileToStorage } from '../../utils/fileUploadClient';
import type { Expense, ExpenseCategory, ExpenseStatus } from '../../types';

type StatusFilter = 'all' | ExpenseStatus;

const statusBadgeClass: Record<ExpenseStatus, string> = {
  pending: 'bg-accent-50 text-accent-700',
  approved: 'bg-brand-100 text-brand-700',
  paid: 'bg-brand-200 text-brand-800',
};

const categories: ExpenseCategory[] = [
  'materials',
  'equipment',
  'subcontractor',
  'travel',
  'permits',
  'overhead',
  'other',
];

const categoryLabel: Record<ExpenseCategory, string> = {
  materials: 'Materials',
  equipment: 'Equipment',
  subcontractor: 'Subcontractor',
  travel: 'Travel',
  permits: 'Permits',
  overhead: 'Overhead',
  other: 'Other',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyExpenseForm = () => ({
  jobId: '',
  vendor: '',
  description: '',
  category: 'materials' as ExpenseCategory,
  expenseDate: todayIso(),
  amount: 0,
  status: 'pending' as ExpenseStatus,
  notes: '',
  receiptUrl: '',
});

export default function ExpensesPage() {
  const { expenses, jobs, customers, addExpense, updateExpense, deleteExpense } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [form, setForm] = useState(emptyExpenseForm());
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  const [receiptPreviewKind, setReceiptPreviewKind] = useState<'image' | 'pdf' | 'other' | null>(null);
  const [receiptPreviewIsObjectUrl, setReceiptPreviewIsObjectUrl] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const jobLookup = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const customerLookup = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  const filteredExpenses = useMemo(() => {
    if (statusFilter === 'all') return expenses;
    return expenses.filter((expense) => expense.status === statusFilter);
  }, [expenses, statusFilter]);

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const pending = expenses
      .filter((expense) => expense.status === 'pending')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const approved = expenses
      .filter((expense) => expense.status === 'approved')
      .reduce((sum, expense) => sum + expense.amount, 0);

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthSpend = expenses
      .filter((expense) => expense.expenseDate.startsWith(thisMonth))
      .reduce((sum, expense) => sum + expense.amount, 0);

    return { total, pending, approved, monthSpend };
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return categories
      .map((category) => {
        const amount = expenses
          .filter((expense) => expense.category === category)
          .reduce((sum, expense) => sum + expense.amount, 0);
        const ratio = total > 0 ? (amount / total) * 100 : 0;
        return { category, amount, ratio };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyExpenseForm());
    setReceiptUploadError('');
    setReceiptPreviewUrl('');
    setReceiptPreviewKind(null);
    setReceiptPreviewIsObjectUrl(false);
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      jobId: expense.jobId ?? '',
      vendor: expense.vendor,
      description: expense.description,
      category: expense.category,
      expenseDate: expense.expenseDate,
      amount: expense.amount,
      status: expense.status,
      notes: expense.notes,
      receiptUrl: expense.receiptUrl ?? '',
    });
    setReceiptUploadError('');
    setReceiptPreviewUrl(expense.receiptUrl ?? '');
    setReceiptPreviewKind(expense.receiptUrl ? 'other' : null);
    setReceiptPreviewIsObjectUrl(false);
    setModalOpen(true);
  };

  useEffect(() => {
    return () => {
      if (receiptPreviewIsObjectUrl && receiptPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewIsObjectUrl, receiptPreviewUrl]);

  const setPreviewFromFile = (file: File) => {
    if (receiptPreviewIsObjectUrl && receiptPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    const mime = file.type.toLowerCase();
    const kind = mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'other';
    setReceiptPreviewUrl(objectUrl);
    setReceiptPreviewKind(kind);
    setReceiptPreviewIsObjectUrl(true);
  };

  const handleReceiptFile = async (file: File) => {
    setPreviewFromFile(file);
    await uploadReceiptFile(file);
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadReceiptFile = async (file: File) => {
    setReceiptUploadError('');
    setReceiptUploading(true);

    try {
      const upload = await uploadFileToStorage({
        file,
        entityType: 'expense',
        entityId: editing?.id ?? '',
        category: 'receipt',
      });

      setField('receiptUrl', upload.fileId);
    } catch (error) {
      setReceiptUploadError(error instanceof Error ? error.message : 'Could not upload receipt.');
    } finally {
      setReceiptUploading(false);
    }
  };

  const saveExpense = () => {
    if (!form.vendor.trim() || !form.description.trim() || form.amount <= 0 || !form.expenseDate) return;

    const payload = {
      jobId: form.jobId.trim() || undefined,
      vendor: form.vendor.trim(),
      description: form.description.trim(),
      category: form.category,
      expenseDate: form.expenseDate,
      amount: Number(form.amount),
      status: form.status,
      notes: form.notes.trim(),
      receiptUrl: form.receiptUrl.trim() || undefined,
    };

    if (editing) {
      updateExpense(editing.id, payload);
    } else {
      addExpense(payload);
    }

    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track spend across jobs and overhead so margin risks are visible early."
        action={<Button onClick={openNew}><FilePlus2 size={16} /> New Expense</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="This Month" value={formatCurrency(totals.monthSpend)} icon={<HandCoins size={28} />} color="text-brand-700" sub="Current month spend" />
        <StatCard label="Pending" value={formatCurrency(totals.pending)} icon={<Receipt size={28} />} color="text-accent-700" sub="Awaiting approval" />
        <StatCard label="Approved" value={formatCurrency(totals.approved)} icon={<Wallet size={28} />} color="text-brand-700" sub="Approved not paid" />
        <StatCard label="Total Spend" value={formatCurrency(totals.total)} icon={<HandCoins size={28} />} color="text-brand-700" sub={`${expenses.length} expenses`} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Expense Register</h2>
            <p className="text-sm text-gray-500 mt-1">Capture, categorize, and review expense transactions in one place.</p>
          </div>
          <div className="w-full sm:w-56">
            <Select label="Status Filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            description="Add your first expense to begin tracking where money is going."
            action={<Button onClick={openNew}><FilePlus2 size={16} /> New Expense</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1180px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((expense) => {
                  const job = expense.jobId ? jobLookup.get(expense.jobId) : undefined;
                  const customer = job ? customerLookup.get(job.customerId) : undefined;
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{expense.expenseDate}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{expense.vendor}</td>
                      <td className="px-4 py-2 text-gray-700">{expense.description}</td>
                      <td className="px-4 py-2 text-gray-700 capitalize">{expense.category.replace('_', ' ')}</td>
                      <td className="px-4 py-2 text-gray-700">{job?.title ?? 'General'}</td>
                      <td className="px-4 py-2 text-gray-700">{customer?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {expense.receiptUrl ? (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
                          >
                            <LinkIcon size={13} /> View
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(expense.amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(expense)}><Pencil size={13} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteExpense(expense.id)}>Delete</Button>
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

      <Card className="mt-6 p-4">
        <h2 className="font-semibold text-gray-900">Spend by Category</h2>
        <p className="text-sm text-gray-500 mt-1">See where expense dollars are concentrated right now.</p>
        {categoryTotals.length === 0 ? (
          <p className="text-sm text-gray-500 mt-3">No expense data available yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {categoryTotals.map((row) => (
              <div key={row.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{categoryLabel[row.category]}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(row.amount)} ({row.ratio.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, row.ratio)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'New Expense'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveExpense}>{editing ? 'Save Changes' : 'Create Expense'}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Input label="Vendor" required value={form.vendor} onChange={(event) => setField('vendor', event.target.value)} placeholder="e.g. Acme Supply" />
          <Input label="Description" required value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="What was purchased" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Category" required value={form.category} onChange={(event) => setField('category', event.target.value as ExpenseCategory)}>
              {categories.map((category) => <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>)}
            </Select>
            <Input label="Expense Date" type="date" required value={form.expenseDate} onChange={(event) => setField('expenseDate', event.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Amount" type="number" min={0} required value={form.amount} onChange={(event) => setField('amount', Number(event.target.value))} />
            <Select label="Status" required value={form.status} onChange={(event) => setField('status', event.target.value as ExpenseStatus)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
          <Select label="Job (Optional)" value={form.jobId} onChange={(event) => setField('jobId', event.target.value)}>
            <option value="">General / Overhead</option>
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </Select>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Receipt File (Optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleReceiptFile(file);
                event.currentTarget.value = '';
              }}
              className="hidden"
              disabled={receiptUploading}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                const file = event.dataTransfer.files?.[0];
                if (!file) return;
                void handleReceiptFile(file);
              }}
              className={`rounded-lg border-2 border-dashed px-4 py-5 text-sm transition-colors ${
                dropActive ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-600 hover:border-brand-400'
              }`}
            >
              <p className="font-medium">Drag and drop receipt here</p>
              <p className="mt-1 text-xs">or click to browse (image or PDF, max 2 MB)</p>
            </div>
            {receiptUploading && <p className="text-xs text-gray-500">Uploading receipt...</p>}
            {receiptUploadError && <p className="text-xs text-accent-700">{receiptUploadError}</p>}
            {form.receiptUrl ? (
              <a href={form.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-800">
                <LinkIcon size={13} /> View uploaded receipt
              </a>
            ) : null}
            {receiptPreviewUrl && receiptPreviewKind === 'image' && (
              <img src={receiptPreviewUrl} alt="Receipt preview" className="mt-2 max-h-48 rounded-md border border-gray-200 object-contain" />
            )}
            {receiptPreviewUrl && receiptPreviewKind === 'pdf' && (
              <iframe title="Receipt preview" src={receiptPreviewUrl} className="mt-2 h-52 w-full rounded-md border border-gray-200" />
            )}
          </div>
          <Input
            label="Receipt URL (Optional)"
            value={form.receiptUrl}
            onChange={(event) => setField('receiptUrl', event.target.value)}
            placeholder="https://..."
          />
          <Input label="Notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Optional notes" />
        </div>
      </Modal>
    </div>
  );
}
