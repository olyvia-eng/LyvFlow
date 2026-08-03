import { Plus, Trash2 } from 'lucide-react';
import type { LineItem, LineItemCategory } from '../../types';
import { generateId, calcLineItemTotal } from '../../utils';
import { formatNumericDisplayValue, parseNumericInputValue } from '../../utils/numberInput';
import { Button } from '../../components/ui';

const CATEGORIES: LineItemCategory[] = ['material', 'equipment', 'labour', 'subcontractor'];

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export default function EstimateLineItemEditor({ items, onChange }: Props) {
  const addItem = () => {
    const newItem: LineItem = {
      id: generateId(),
      category: 'labour',
      description: '',
      quantity: 1,
      unit: 'hr',
      unitCost: 0,
      markup: 0,
      total: 0,
    };
    onChange([...items, newItem]);
  };

  const update = (id: string, key: keyof LineItem, value: unknown) => {
    onChange(
      items.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [key]: value };
        updated.total = calcLineItemTotal(updated.quantity, updated.unitCost, updated.markup);
        return updated;
      })
    );
  };

  const remove = (id: string) => onChange(items.filter((li) => li.id !== id));

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No line items yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="pb-1 font-medium text-left w-28">Category</th>
                <th className="pb-1 font-medium text-left">Description</th>
                <th className="pb-1 font-medium text-right w-16">Qty</th>
                <th className="pb-1 font-medium text-left w-16">Unit</th>
                <th className="pb-1 font-medium text-right w-24">Unit Cost</th>
                <th className="pb-1 font-medium text-right w-20">Markup %</th>
                <th className="pb-1 font-medium text-right w-24">Total</th>
                <th className="pb-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((li) => (
                <tr key={li.id} className="border-b border-gray-100">
                  <td className="py-1 pr-1">
                    <select
                      value={li.category}
                      onChange={(e) => update(li.id, 'category', e.target.value)}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-xs"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      value={li.description}
                      onChange={(e) => update(li.id, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={formatNumericDisplayValue(li.quantity)}
                      onChange={(e) => update(li.id, 'quantity', parseNumericInputValue(e.target.value))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-right text-xs"
                    />
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      value={li.unit}
                      onChange={(e) => update(li.id, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={formatNumericDisplayValue(li.unitCost)}
                      onChange={(e) => update(li.id, 'unitCost', parseNumericInputValue(e.target.value))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-right text-xs"
                    />
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0}
                      max={200}
                      value={formatNumericDisplayValue(li.markup)}
                      onChange={(e) => update(li.id, 'markup', parseNumericInputValue(e.target.value))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-right text-xs"
                    />
                  </td>
                  <td className="py-1 pr-1 text-right font-semibold whitespace-nowrap">
                    ${li.total.toFixed(2)}
                  </td>
                  <td className="py-1">
                    <button onClick={() => remove(li.id)} className="text-red-400 hover:text-red-600 p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={addItem}>
        <Plus size={14} /> Add Line Item
      </Button>
    </div>
  );
}
