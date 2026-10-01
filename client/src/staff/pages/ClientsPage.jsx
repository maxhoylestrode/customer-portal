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
        <h1 className="text-2xl font-bold text-[#0D3040]">Clients</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
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
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Search
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
          No clients found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-white">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">Projects</th>
                <th className="px-4 py-3 font-medium text-gray-500">Sales Rep</th>
                <th className="px-4 py-3 font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="transition hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/staff/clients/${c.id}`} className="flex items-center gap-3 hover:underline">
                      <ClientAvatar client={c} size="sm" />
                      <span className="font-medium text-brand-600">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.company || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c._count?.projects ?? 0}</td>
                  <td className="px-4 py-3">
                    {c.salesPerson ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{c.salesPerson.name}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
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
  // "new" creates a standalone CRM client; "link" starts from an existing ticket-portal login
  const [mode, setMode] = useState('new');
  const [portalSearch, setPortalSearch] = useState('');
  const [portalUsers, setPortalUsers] = useState([]);
  const [linkedUser, setLinkedUser] = useState(null);

  useEffect(() => {
    if (open) {
      api.get('/users').then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      // Auto-assign current user if they're a sales person
      if (isSales) setForm((f) => ({ ...f, salesPersonId: String(currentUser.id) }));
    }
  }, [open, isSales, currentUser?.id]);

  useEffect(() => {
    if (!open || mode !== 'link') return;
    const t = setTimeout(() => {
      api
        .get('/clients/portal-users', { params: portalSearch.trim() ? { search: portalSearch.trim() } : {} })
        .then((r) => setPortalUsers(Array.isArray(r.data) ? r.data : []))
        .catch(() => setPortalUsers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [open, mode, portalSearch]);

  const resetForm = () => {
    setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '', tags: [], hostingTier: '', salesPersonId: '' });
    setMode('new');
    setPortalSearch('');
    setLinkedUser(null);
  };

  const pickPortalUser = (u) => {
    setLinkedUser(u);
    setForm((f) => ({
      ...f,
      name: u.name || f.name,
      email: u.email || f.email,
      company: u.company_name || f.company,
      phone: u.phone || f.phone,
    }));
  };

  const switchMode = (next) => {
    setMode(next);
    if (next === 'new') setLinkedUser(null);
  };

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
        portalUserId: linkedUser ? linkedUser.id : null,
      });
      toast.success(linkedUser ? `Client created and linked to ${linkedUser.name}'s portal login` : 'Client created');
      resetForm();
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="New Client" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New client, or start from someone already on the ticket portal */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          {[
            ['new', 'New client'],
            ['link', 'Existing portal client'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === value ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'link' && (
          linkedUser ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Linking to portal login</p>
                <p className="truncate text-sm font-semibold text-gray-900">{linkedUser.name}</p>
                <p className="truncate text-xs text-gray-500">{linkedUser.email}{linkedUser.company_name ? ` · ${linkedUser.company_name}` : ''}</p>
              </div>
              <button type="button" onClick={() => setLinkedUser(null)} className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700">
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                autoFocus
                value={portalSearch}
                onChange={(e) => setPortalSearch(e.target.value)}
                placeholder="Search portal clients by name, email or company"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
              />
              <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                {portalUsers.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No portal clients found</p>
                ) : (
                  portalUsers.map((u) => {
                    const taken = u.linked_client_id != null;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={taken}
                        onClick={() => pickPortalUser(u)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{u.name}</span>
                          <span className="block truncate text-xs text-gray-500">{u.email}{u.company_name ? ` · ${u.company_name}` : ''}</span>
                        </span>
                        {taken && <span className="shrink-0 text-xs text-gray-500">Already linked</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )
        )}

        {(mode === 'new' || linkedUser) && (<>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name *" value={form.name} onChange={set('name')} required />
          <Input label="Company" value={form.company} onChange={set('company')} />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <Input label="Address" value={form.address} onChange={set('address')} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={set('notes')}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
          />
        </div>
        {/* Salesperson */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Sales Rep <span className="text-gray-500 font-normal">(10% commission)</span></label>
          {isSales ? (
            <p className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-emerald-700">{currentUser?.name} <span className="text-gray-500">(you)</span></p>
          ) : (
            <select value={form.salesPersonId} onChange={set('salesPersonId')}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 focus:border-brand-700 focus:outline-none">
              <option value="">— No sales rep —</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>)}
            </select>
          )}
        </div>
        <TagCheckboxes selected={form.tags} onToggle={toggleTag} />
        {form.tags.includes('Website Hosting') && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hosting Plan</label>
            <select
              value={form.hostingTier}
              onChange={set('hostingTier')}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
            >
              <option value="">— Select tier —</option>
              {HOSTING_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        </>)}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (mode === 'link' && !linkedUser)}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
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
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
      />
    </div>
  );
}

export function TagCheckboxes({ selected, onToggle }) {
  const safeSelected = Array.isArray(selected) ? selected : [];
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">Tags</label>
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
                  ? 'border-brand-600 bg-brand-100 text-brand-600'
                  : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:text-gray-800'
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
        className={`${dim} rounded-full object-cover ring-1 ring-gray-200`}
      />
    );
  }
  // Deterministic color from name
  const colors = ['bg-violet-600','bg-brand-700','bg-blue-600','bg-teal-600','bg-emerald-600','bg-amber-600','bg-rose-600'];
  const color = colors[(client.name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${dim} ${color} flex items-center justify-center rounded-full font-semibold uppercase text-white`}>
      {client.name?.[0] || '?'}
    </div>
  );
}
