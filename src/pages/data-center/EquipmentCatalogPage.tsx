import { useMemo, useState } from 'react';
import { PencilLine, PlusCircle, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from '../../components/ui';
import { useStore } from '../../store';
import type { EquipmentAsset, EquipmentCostType, EquipmentStatus } from '../../types';

interface EquipmentFormState {
  name: string;
  type: string;
  status: EquipmentStatus;
  costType: EquipmentCostType;
  serialNumber: string;
  purchaseDate: string;
  hourlyCost: number;
  notes: string;
}

const emptyForm = (): EquipmentFormState => ({
  name: '',
  type: '',
  status: 'available',
  costType: 'owned',
  serialNumber: '',
  purchaseDate: '',
  hourlyCost: 0,
  notes: '',
});

export default function EquipmentCatalogPage() {
  const equipmentAssets = useStore((state) => state.equipmentAssets);
  const addEquipmentAsset = useStore((state) => state.addEquipmentAsset);
  const updateEquipmentAsset = useStore((state) => state.updateEquipmentAsset);
  const deleteEquipmentAsset = useStore((state) => state.deleteEquipmentAsset);

  const [form, setForm] = useState<EquipmentFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedEquipment = useMemo(() => {
    return [...equipmentAssets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [equipmentAssets]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.type.trim()) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type.trim(),
      status: form.status,
      costType: form.costType,
      serialNumber: form.serialNumber.trim(),
      purchaseDate: form.purchaseDate || undefined,
      hourlyCost: Number(form.hourlyCost || 0),
      notes: form.notes.trim(),
    };

    if (editingId) {
      updateEquipmentAsset(editingId, payload);
    } else {
      addEquipmentAsset(payload);
    }

    resetForm();
  };

  const startEditing = (asset: EquipmentAsset) => {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      costType: asset.costType,
      serialNumber: asset.serialNumber,
      purchaseDate: asset.purchaseDate ?? '',
      hourlyCost: asset.hourlyCost,
      notes: asset.notes,
    });
  };

  const handleDelete = (asset: EquipmentAsset) => {
    const confirmed = window.confirm(`Remove ${asset.name} from the equipment catalog?`);
    if (!confirmed) return;
    deleteEquipmentAsset(asset.id);
    if (editingId === asset.id) {
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment Catalog"
        subtitle="Maintain the shared equipment list used across settings, job planning, and field operations."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Equipment' : 'Add Equipment'}</h2>
              <p className="text-sm text-gray-500">Keep the catalog current so crews can choose the right asset quickly.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Equipment Name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              label="Type"
              required
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              placeholder="Excavator"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EquipmentStatus }))}
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </Select>
              <Select
                label="Cost Type"
                value={form.costType}
                onChange={(event) => setForm((current) => ({ ...current, costType: event.target.value as EquipmentCostType }))}
              >
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="financed">Financed</option>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Serial Number"
                value={form.serialNumber}
                onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))}
              />
              <Input
                label="Purchase Date"
                type="date"
                value={form.purchaseDate}
                onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
              />
            </div>
            <Input
              label="Hourly Cost"
              type="number"
              min="0"
              step="0.01"
              value={form.hourlyCost}
              onChange={(event) => setForm((current) => ({ ...current, hourlyCost: Number(event.target.value || 0) }))}
            />
            <TextArea
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Maintenance note, special handling, or job notes"
            />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 justify-center">
                {editingId ? 'Save Changes' : 'Add to Catalog'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Catalog</h2>
              <p className="text-sm text-gray-500">{sortedEquipment.length} equipment items tracked</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              <PlusCircle size={16} />
              Shared list
            </div>
          </div>

          {sortedEquipment.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-8 text-center">
              <p className="text-base font-semibold text-brand-800">No equipment yet</p>
              <p className="mt-2 text-sm text-brand-500">Add the first machine or tool so it shows up in settings and job planning.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEquipment.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                        <Badge label={asset.status} className="bg-brand-50 text-brand-700" />
                        <Badge label={asset.costType} className="bg-accent-50 text-accent-700" />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{asset.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(asset)}>
                        <PencilLine size={14} />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(asset)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                    <span>Serial: {asset.serialNumber || '—'}</span>
                    <span>Hourly: ${asset.hourlyCost.toFixed(2)}</span>
                    <span>Updated: {new Date(asset.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {asset.notes && <p className="mt-3 text-sm text-gray-600">{asset.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
