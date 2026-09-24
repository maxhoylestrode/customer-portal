import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePortal } from '../context/PortalContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const { logoUrl, refreshLogo } = usePortal();
  const [showAddUser, setShowAddUser] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // User management (admin)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // user object to edit
  const [showEditUser, setShowEditUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const res = await api.get('/settings/users');
      setUsers(res.data.users);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post('/settings/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Logo updated');
      refreshLogo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!confirm('Remove the portal logo?')) return;
    await api.delete('/settings/logo');
    toast.success('Logo removed');
    refreshLogo();
  };

  const handleDeleteUser = async (target) => {
    if (!confirm(`Delete user "${target.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/settings/users/${target.id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const openEdit = (target) => {
    setEditTarget(target);
    setShowEditUser(true);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Portal Logo */}
      <div className="rounded-xl border border-gray-800 bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Portal Logo</h2>
        <div className="flex items-center gap-6">
          {/* Preview */}
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-gray-700 bg-surface-light">
            {logoUrl ? (
              <img src={logoUrl} alt="Portal logo" className="h-16 w-16 rounded-lg object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold">
                A
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Shown in the sidebar. Accepted: .jpg, .png, .webp, .svg, .gif (max 5 MB).
            </p>
            <div className="flex gap-3">
              <label className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp,.svg,.gif"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </label>
              {logoUrl && (
                <button
                  onClick={handleLogoRemove}
                  className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current user card */}
      <div className="rounded-xl border border-gray-800 bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Your Profile</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="mt-0.5 text-gray-200">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="mt-0.5 text-gray-200">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Role</dt>
            <dd className="mt-0.5">
              <span className="rounded-full bg-brand-600/20 px-2.5 py-0.5 text-xs font-medium text-brand-400">
                {user?.role}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Admin: User Management */}
      {user?.role === 'admin' && (
        <div className="rounded-xl border border-gray-800 bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">User Management</h2>
              <p className="mt-1 text-sm text-gray-500">Manage all staff accounts</p>
            </div>
            <button
              onClick={() => setShowAddUser(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              + Add User
            </button>
          </div>

          {loadingUsers ? (
            <p className="text-sm text-gray-500">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">Joined</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-800 last:border-0"
                    >
                      <td className="py-3 pr-4 text-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/30 text-xs font-bold text-brand-400">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                          {u.id === user.id && (
                            <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">You</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-yellow-600/20 text-yellow-400'
                              : u.role === 'sales'
                              ? 'bg-emerald-600/20 text-emerald-400'
                              : 'bg-brand-600/20 text-brand-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-brand-500 hover:text-brand-400"
                          >
                            Edit
                          </button>
                          {u.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* About */}
      <div className="rounded-xl border border-gray-800 bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">About</h2>
        <p className="text-sm text-gray-400">
          Apex Studio Codes Staff Portal v1.0.0
          <br />
          Built with React, Express, PostgreSQL &amp; Prisma.
        </p>
      </div>

      <AddUserModal
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        onCreated={fetchUsers}
      />

      <EditUserModal
        open={showEditUser}
        user={editTarget}
        currentUserId={user?.id}
        onClose={() => { setShowEditUser(false); setEditTarget(null); }}
        onSaved={fetchUsers}
      />
    </div>
  );
}

// ── Add User Modal ─────────────────────────────────────────────────────────────
function AddUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings/users', form);
      toast.success('User created');
      setForm({ name: '', email: '', password: '', role: 'staff' });
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Staff User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Role</label>
          <select
            value={form.role}
            onChange={set('role')}
            className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="staff">Staff</option>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────
function EditUserModal({ open, user: target, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', password: '' });
  const [saving, setSaving] = useState(false);

  // Populate form when target changes
  useEffect(() => {
    if (target) {
      setForm({ name: target.name, email: target.email, role: target.role, password: '' });
    }
  }, [target]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      await api.put(`/settings/users/${target.id}`, payload);
      toast.success('User updated');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const isSelf = target?.id === currentUserId;

  return (
    <Modal open={open} onClose={onClose} title={`Edit User – ${target?.name ?? ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Role</label>
          <select
            value={form.role}
            onChange={set('role')}
            disabled={isSelf}
            className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="staff">Staff</option>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
          {isSelf && <p className="mt-1 text-xs text-gray-500">You cannot change your own role.</p>}
        </div>
        <Input
          label="New Password (leave blank to keep current)"
          type="password"
          value={form.password}
          onChange={set('password')}
          placeholder="••••••••"
        />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Shared Input ───────────────────────────────────────────────────────────────
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