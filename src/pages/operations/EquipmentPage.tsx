import { useMemo, useState } from 'react';
import { FilePlus2, HardHat, Pencil, Wrench, Zap } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard } from '../../components/ui';
import { useStore } from '../../store';
import { formatCurrency } from '../../utils';
import type { EquipmentAsset, EquipmentCostType, EquipmentStatus } from '../../types';

const statuses: EquipmentStatus[] = ['available', 'in_use', 'maintenance', 'inactive'];
const costTypes: EquipmentCostType[] = ['financed', 'leased', 'owned'];

const statusBadgeClass: Record<EquipmentStatus, string> = {
  available: 'bg-brand-100 text-brand-700',
  in_use: 'bg-accent-50 text-accent-700',
  maintenance: 'bg-accent-100 text-accent-700',
  inactive: 'bg-gray-100 text-gray-600',
};

const emptyEquipmentForm = () => ({
  name: '',
  type: '',
  status: 'available' as EquipmentStatus,
  costType: 'owned' as EquipmentCostType,
  serialNumber: '',
  purchaseDate: '',
  hourlyCost: 0,
  currentJobId: '',
  notes: '',
});

export default function EquipmentPage() {
  const { equipmentAssets, jobs, addEquipmentAsset, updateEquipmentAsset, deleteEquipmentAsset } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentAsset | null>(null);
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all');
  const [form, setForm] = useState(emptyEquipmentForm());

  const jobLookup = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const filteredAssets = useMemo(() => {
    if (statusFilter === 'all') return equipmentAssets;
    return equipmentAssets.filter((asset) => asset.status === statusFilter);
  }, [equipmentAssets, statusFilter]);

  const totals = useMemo(() => {
    const available = equipmentAssets.filter((asset) => asset.status === 'available').length;
    const inUse = equipmentAssets.filter((asset) => asset.status === 'in_use').length;
    const maintenance = equipmentAssets.filter((asset) => asset.status === 'maintenance').length;
    const hourlyExposure = equipmentAssets
      .filter((asset) => asset.status === 'in_use')
      .reduce((sum, asset) => sum + asset.hourlyCost, 0);

    return { available, inUse, maintenance, hourlyExposure };
  }, [equipmentAssets]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyEquipmentForm());
    setModalOpen(true);
  };

  const openEdit = (asset: EquipmentAsset) => {
    setEditing(asset);
    setForm({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      costType: asset.costType,
      serialNumber: asset.serialNumber,
      purchaseDate: asset.purchaseDate ?? '',
      hourlyCost: asset.hourlyCost,
      currentJobId: asset.currentJobId ?? '',
      notes: asset.notes,
    });
    setModalOpen(true);
  };

  const saveAsset = () => {
    if (!form.name.trim() || !form.type.trim()) return;

    const payload = {
      name: form.name.trim(),
      type: form.type.trim(),
      status: form.status,
      costType: form.costType,
      serialNumber: form.serialNumber.trim(),
      purchaseDate: form.purchaseDate || undefined,
      hourlyCost: Number(form.hourlyCost),
      currentJobId: form.currentJobId || undefined,
      notes: form.notes.trim(),
    };

    if (editing) {
      updateEquipmentAsset(editing.id, payload);
    } else {
      addEquipmentAsset(payload);
    }

    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Equipment"
        subtitle="Track availability, assignments, and operating cost for field equipment."
        action={<Button onClick={openNew}><FilePlus2 size={16} /> Add Equipment</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Available" value={String(totals.available)} icon={<HardHat size={28} />} color="text-brand-700" sub="Ready to assign" />
        <StatCard label="In Use" value={String(totals.inUse)} icon={<Zap size={28} />} color="text-accent-700" sub="Assigned to active jobs" />
        <StatCard label="Maintenance" value={String(totals.maintenance)} icon={<Wrench size={28} />} color="text-accent-700" sub="Out for service" />
        <StatCard label="In-Use $/hr" value={formatCurrency(totals.hourlyExposure)} icon={<HardHat size={28} />} color="text-brand-700" sub="Combined active burn rate" />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Equipment Register</h2>
            <p className="text-sm text-gray-500 mt-1">Manage machine status, assignment, and hourly cost assumptions.</p>
          </div>
          <div className="w-full sm:w-56">
            <Select label="Status Filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EquipmentStatus | 'all')}>
              <option value="all">All</option>
              {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </Select>
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <EmptyState
            title="No equipment tracked yet"
            description="Add your first machine to manage deployment and cost visibility."
            action={<Button onClick={openNew}><FilePlus2 size={16} /> Add Equipment</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1120px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Serial</th>
                  <th className="px-4 py-3 font-medium">Cost Type</th>
                  <th className="px-4 py-3 font-medium">Assigned Job</th>
                  <th className="px-4 py-3 font-medium text-right">Hourly Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAssets.map((asset) => {
                  const job = asset.currentJobId ? jobLookup.get(asset.currentJobId) : undefined;
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{asset.name}</td>
                      <td className="px-4 py-2 text-gray-700">{asset.type}</td>
                      <td className="px-4 py-2 text-gray-700">{asset.serialNumber || '—'}</td>
                      <td className="px-4 py-2 text-gray-700 capitalize">{asset.costType}</td>
                      <td className="px-4 py-2 text-gray-700">{job?.title ?? 'Unassigned'}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(asset.hourlyCost)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass[asset.status]}`}>
                          {asset.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(asset)}><Pencil size={13} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEquipmentAsset(asset.id)}>Delete</Button>
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
        title={editing ? 'Edit Equipment' : 'Add Equipment'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveAsset}>{editing ? 'Save Changes' : 'Create Equipment'}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Equipment Name" required value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. CAT 305 Excavator" />
            <Input label="Type" required value={form.type} onChange={(event) => setField('type', event.target.value)} placeholder="e.g. Excavator" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Serial Number" value={form.serialNumber} onChange={(event) => setField('serialNumber', event.target.value)} placeholder="Optional" />
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={(event) => setField('purchaseDate', event.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Status" required value={form.status} onChange={(event) => setField('status', event.target.value as EquipmentStatus)}>
              {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </Select>
            <Select label="Cost Type" required value={form.costType} onChange={(event) => setField('costType', event.target.value as EquipmentCostType)}>
              {costTypes.map((costType) => <option key={costType} value={costType}>{costType.charAt(0).toUpperCase() + costType.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Hourly Cost" type="number" min={0} required value={form.hourlyCost} onChange={(event) => setField('hourlyCost', Number(event.target.value))} />
            <Select label="Assigned Job" value={form.currentJobId} onChange={(event) => setField('currentJobId', event.target.value)}>
              <option value="">Unassigned</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </Select>
          </div>
          <Input label="Notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Optional notes" />
        </div>
      </Modal>
    </div>
  );
}
