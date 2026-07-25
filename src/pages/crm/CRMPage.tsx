import { useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Badge, Modal, Input, Select, TextArea, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, Phone, Mail, MapPin } from 'lucide-react';
import { statusColor } from '../../utils';
import type { Customer, CustomerStatus } from '../../types';

const STATUSES: CustomerStatus[] = ['lead', 'prospect', 'active', 'inactive'];

const emptyCustomer = (): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  company: '',
  email: '',
  phone: '',
  address: { street: '', city: '', province: '', postalCode: '', country: 'Canada' },
  status: 'lead',
  notes: '',
  tags: [],
});

export default function CRMPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyCustomer());
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name, company: c.company, email: c.email, phone: c.phone,
      address: { ...c.address }, status: c.status, notes: c.notes, tags: c.tags,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      updateCustomer(editing.id, form);
    } else {
      addCustomer(form);
    }
    setModalOpen(false);
  };

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setAddr = (key: keyof typeof form.address, value: string) =>
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle="Manage your customers, leads, and contacts."
        action={<Button onClick={openNew}><Plus size={16} /> New Customer</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No customers found" description="Add your first customer to get started." action={<Button onClick={openNew}><Plus size={16}/> New Customer</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                  {c.company && <p className="text-sm text-gray-500 truncate">{c.company}</p>}
                </div>
                <Badge label={c.status} className={statusColor[c.status]} />
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-gray-400" />
                    <a href={`mailto:${c.email}`} className="hover:text-brand-600 truncate">{c.email}</a>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-gray-400" />
                    <a href={`tel:${c.phone}`} className="hover:text-brand-600">{c.phone}</a>
                  </div>
                )}
                {c.address.city && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400" />
                    <span>{c.address.city}, {c.address.province}</span>
                  </div>
                )}
              </div>
              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {c.tags.map((t) => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              )}
              {c.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{c.notes}</p>}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                  <Pencil size={13} /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(c.id)}>
                  <Trash2 size={13} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'New Customer'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="Company" value={form.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as CustomerStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <fieldset className="border border-gray-200 rounded-lg p-3">
            <legend className="text-sm font-medium text-gray-700 px-1">Address</legend>
            <div className="space-y-3 mt-2">
              <Input label="Street" value={form.address.street} onChange={(e) => setAddr('street', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" value={form.address.city} onChange={(e) => setAddr('city', e.target.value)} />
                <Input label="Province" value={form.address.province} onChange={(e) => setAddr('province', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Postal Code" value={form.address.postalCode} onChange={(e) => setAddr('postalCode', e.target.value)} />
                <Input label="Country" value={form.address.country} onChange={(e) => setAddr('country', e.target.value)} />
              </div>
            </div>
          </fieldset>
          <Input
            label="Tags (comma-separated)"
            value={form.tags.join(', ')}
            onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
          <TextArea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Customer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCustomer(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600">Are you sure you want to delete this customer? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
