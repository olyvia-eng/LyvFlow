import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Modal, Input, Select, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils';
import type { BudgetItem, BudgetCategory } from '../../types';

const CATEGORIES: BudgetCategory[] = ['revenue', 'labour', 'materials', 'equipment', 'subcontractors', 'overhead', 'marketing', 'insurance', 'other'];

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const empty = (): Omit<BudgetItem, 'id'> => ({
  category: 'labour',
  description: '',
  budgeted: 0,
  actual: 0,
  period: currentPeriod(),
});

export default function BudgetPage() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem } = useStore();
  const [period, setPeriod] = useState(currentPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState(empty());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const items = budgetItems.filter((b) => b.period === period);
  const allPeriods = [...new Set(budgetItems.map((b) => b.period))].sort().reverse();

  const openNew = () => { setEditing(null); setForm({ ...empty(), period }); setModalOpen(true); };
  const openEdit = (b: BudgetItem) => {
    setEditing(b);
    setForm({ category: b.category, description: b.description, budgeted: b.budgeted, actual: b.actual, period: b.period });
    setModalOpen(true);
  };
  const handleSave = () => {
    if (!form.description.trim()) return;
    if (editing) updateBudgetItem(editing.id, form);
    else addBudgetItem(form);
    setModalOpen(false);
  };
  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  // Summaries
  const revenue = items.filter((b) => b.category === 'revenue');
  const expenses = items.filter((b) => b.category !== 'revenue');

  const totalBudgetedRevenue = revenue.reduce((s, b) => s + b.budgeted, 0);
  const totalActualRevenue = revenue.reduce((s, b) => s + b.actual, 0);
  const totalBudgetedExpenses = expenses.reduce((s, b) => s + b.budgeted, 0);
  const totalActualExpenses = expenses.reduce((s, b) => s + b.actual, 0);
  const budgetedProfit = totalBudgetedRevenue - totalBudgetedExpenses;
  const actualProfit = totalActualRevenue - totalActualExpenses;

  const grouped = CATEGORIES.reduce<Record<BudgetCategory, BudgetItem[]>>((acc, cat) => {
    acc[cat] = items.filter((b) => b.category === cat);
    return acc;
  }, {} as Record<BudgetCategory, BudgetItem[]>);

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle="Track your company budget by month."
        action={<Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>}
      />

      {/* Period selector */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">Period:</label>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {allPeriods.filter((p) => p !== period).length > 0 && (
          <select onChange={(e) => setPeriod(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-500">
            <option value="">Jump to period…</option>
            {allPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Budgeted Revenue</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalBudgetedRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Actual Revenue</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalActualRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Budget vs Actual Profit</p>
          <p className={`text-xl font-bold ${budgetedProfit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(budgetedProfit)}</p>
          <p className={`text-xs ${actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Actual: {formatCurrency(actualProfit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Expenses</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalActualExpenses)}</p>
          <p className="text-xs text-gray-400">Budget: {formatCurrency(totalBudgetedExpenses)}</p>
        </Card>
      </div>

      {items.length === 0 ? (
        <EmptyState title={`No budget items for ${period}`} action={<Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                <th className="px-4 py-3 font-medium text-right">Actual</th>
                <th className="px-4 py-3 font-medium text-right">Variance</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CATEGORIES.map((cat) => {
                const catItems = grouped[cat];
                if (catItems.length === 0) return null;
                return catItems.map((b, idx) => {
                  const variance = b.category === 'revenue'
                    ? b.actual - b.budgeted
                    : b.budgeted - b.actual;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      {idx === 0 && (
                        <td className="px-4 py-2 font-medium capitalize" rowSpan={catItems.length}>
                          {cat}
                        </td>
                      )}
                      <td className="px-4 py-2 text-gray-700">{b.description}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(b.budgeted)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(b.actual)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Pencil size={13} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b.id)}><Trash2 size={13} className="text-red-400" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Budget Item' : 'New Budget Item'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value as BudgetCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </Select>
            <Input label="Period (YYYY-MM)" value={form.period} onChange={(e) => set('period', e.target.value)} />
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Budgeted ($)" type="number" min={0} value={form.budgeted} onChange={(e) => set('budgeted', Number(e.target.value))} />
            <Input label="Actual ($)" type="number" min={0} value={form.actual} onChange={(e) => set('actual', Number(e.target.value))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Budget Item"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteBudgetItem(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
        </>}
      >
        <p className="text-gray-600">Delete this budget item?</p>
      </Modal>
    </div>
  );
}
