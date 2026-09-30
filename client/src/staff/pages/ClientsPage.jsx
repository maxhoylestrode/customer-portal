import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export const PREDEFINED_TAGS = [
  'Website Development',
  'Website Hosting',
  'Cyber Essentials',
  'IT Support',
];

export const HOSTING_TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchClients = () => {
    setLoading(true);
    api
      .get('/clients', { params: { search: search || undefined } })
      .then((r) => setClients(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New Client
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name, company, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-surface-lighter px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600"
        >
          Search
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-surface p-10 text-center text-gray-500">
          No clients found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-400">Client</th>
                <th className="px-4 py-3 font-medium text-gray-400">Company</th>
                <th className="px-4 py-3 font-medium text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-400">Projects</th>
                <th className="px-4 py-3 font-medium text-gray-400">Sales Rep</th>
                <th className="px-4 py-3 font-medium text-gray-400">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {clients.map((c) => (
                <tr key={c.id} className="transition hover:bg-surface-light">
                  <td className="px-4 py-3">
                    <Link to={`/staff/clients/${c.id}`} className="flex items-center gap-3 hover:underline">
                      <ClientAvatar client={c} size="sm" />
                      <span className="font-medium text-brand-400">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.company || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c._count?.projects ?? 0}</td>
                  <td className="px-4 py-3">
                    {c.salesPerson ? (
                      <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400">{c.salesPerson.name}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <CreateClientModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchClients();
        }}
      />
    </div>
  );
}

function CreateClientModal({ open, onClose, onCreated }) {
  const { user: currentUser } = useAuth();
  const isSales = currentUser?.role === 'sales';
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', address: '', notes: '', tags: [], hostingTier: '', salesPersonId: '' });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/users').then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      // Auto-assign current user if they're a sales person
      if (isSales) setForm((f) => ({ ...f, salesPersonId: String(currentUser.id) }));
    }
  }, [open, isSales, currentUser?.id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleTag = (tag) => {
    const next = form.tags.includes(tag)
      ? form.tags.filter((t) => t !== tag)
      : [...form.tags, tag];
    const hostingTier = next.includes('Website Hosting') ? form.hostingTier : '';
    setForm({ ...form, tags: next, hostingTier });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/clients', {
        ...form,
        hostingTier: form.tags.includes('Website Hosting') ? form.hostingTier || null : null,
        salesPersonId: form.salesPersonId ? parseInt(form.salesPersonId, 10) : null,
      });
      toast.success('Client created');
      setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '', tags: [], hostingTier: '', salesPersonId: '' });
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Client" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name *" value={form.name} onChange={set('name')} required />
          <Input label="Company" value={form.company} onChange={set('company')} />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <Input label="Address" value={form.address} onChange={set('address')} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={set('notes')}
            className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {/* Salesperson */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Sales Rep <span className="text-gray-500 font-normal">(10% commission)</span></label>
          {isSales ? (
            <p className="rounded-lg border border-gray-700 bg-surface px-4 py-2 text-sm text-emerald-400">{currentUser?.name} <span className="text-gray-500">(you)</span></p>
          ) : (
            <select value={form.salesPersonId} onChange={set('salesPersonId')}
              className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none">
              <option value="">— No sales rep —</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>)}
            </select>
          )}
        </div>
        <TagCheckboxes selected={form.tags} onToggle={toggleTag} />
        {form.tags.includes('Website Hosting') && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Hosting Plan</label>
            <select
              value={form.hostingTier}
              onChange={set('hostingTier')}
              className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Select tier —</option>
              {HOSTING_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

export function TagCheckboxes({ selected, onToggle }) {
  const safeSelected = Array.isArray(selected) ? selected : [];
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">Tags</label>
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_TAGS.map((tag) => {
          const active = safeSelected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'border-brand-500 bg-brand-600/30 text-brand-300'
                  : 'border-gray-700 bg-surface-light text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {active && <span className="mr-1">✓</span>}
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ClientAvatar({ client, size = 'md' }) {
  const dim =
    size === 'sm' ? 'h-7 w-7 text-xs' :
    size === 'lg' ? 'h-14 w-14 text-lg' :
    'h-10 w-10 text-sm';
  if (client.avatarUrl) {
    return (
      <img
        src={client.avatarUrl}
        alt={client.name}
        className={`${dim} rounded-full object-cover ring-1 ring-gray-700`}
      />
    );
  }
  // Deterministic color from name
  const colors = ['bg-violet-600','bg-indigo-600','bg-blue-600','bg-teal-600','bg-emerald-600','bg-amber-600','bg-rose-600'];
  const color = colors[(client.name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${dim} ${color} flex items-center justify-center rounded-full font-semibold uppercase text-white`}>
      {client.name?.[0] || '?'}
    </div>
  );
}
