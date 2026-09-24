import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { ClientAvatar, PREDEFINED_TAGS, HOSTING_TIERS, TagCheckboxes } from './ClientsPage';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProject, setEditProject] = useState(null);

  const fetchClient = () => {
    setLoading(true);
    api
      .get(`/clients/${id}`)
      .then((r) => {
        const data = r.data;
        // Ensure array fields are always arrays
        data.tags = Array.isArray(data.tags) ? data.tags : [];
        data.projects = Array.isArray(data.projects) ? data.projects : [];
        data.files = Array.isArray(data.files) ? data.files : [];
        data.projects = data.projects.map((p) => ({
          ...p,
          milestones: Array.isArray(p.milestones) ? p.milestones : [],
          assignedUsers: Array.isArray(p.assignedUsers) ? p.assignedUsers : [],
        }));
        setClient(data);
      })
      .catch(() => {
        toast.error('Client not found');
        navigate('/staff/clients');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this client and all associated data?')) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client deleted');
      navigate('/staff/clients');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );

  if (!client) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {/* Avatar with upload overlay */}
          <div className="group relative">
            <ClientAvatar client={client} size="lg" />
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg,.gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('avatar', file);
                  try {
                    await api.post(`/clients/${client.id}/avatar`, fd, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    toast.success('Avatar updated');
                    fetchClient();
                  } catch {
                    toast.error('Upload failed');
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div>
            <button onClick={() => navigate('/staff/clients')} className="mb-1 text-sm text-gray-500 hover:text-gray-300">
              ← Back to Clients
            </button>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.company && <p className="text-gray-400">{client.company}</p>}
            {client.avatarUrl && (
              <button
                onClick={async () => {
                  try {
                    await api.delete(`/clients/${client.id}/avatar`);
                    toast.success('Avatar removed');
                    fetchClient();
                  } catch {
                    toast.error('Failed to remove avatar');
                  }
                }}
                className="mt-1 text-xs text-gray-500 hover:text-red-400"
              >
                Remove avatar
              </button>
            )}
            {Array.isArray(client.tags) && client.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {client.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-600/20 px-2.5 py-0.5 text-xs font-medium text-brand-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {client.salesPerson && (
              <div className="mt-2 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-gray-400">Sales Rep:</span>
                <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">{client.salesPerson.name}</span>
                <span className="text-xs text-gray-600">(10% commission)</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-surface-lighter"
          >
            Edit
          </button>
          {currentUser?.role !== 'sales' && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="rounded-xl border border-gray-800 bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Contact Information</h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <InfoItem label="Email" value={client.email} />
              <InfoItem label="Phone" value={client.phone} />
              <InfoItem label="Address" value={client.address} className="sm:col-span-2" />
            </dl>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="rounded-xl border border-gray-800 bg-surface p-5">
              <h2 className="mb-3 text-lg font-semibold">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-300">{client.notes}</p>
            </div>
          )}

          {/* Hosting Plan — visible only when "Website Hosting" tag is active */}
          {client.tags?.includes('Website Hosting') && (
            <div className="rounded-xl border border-brand-700/40 bg-surface p-5">
              <h2 className="mb-3 text-lg font-semibold text-brand-300">Hosting Plan</h2>
              {client.hostingTier ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-600/20 px-3 py-1 text-sm font-semibold text-brand-300">
                    {client.hostingTier}
                  </span>
                  <span className="text-sm text-gray-400">— Website Hosting</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hosting tier set. Edit the client to assign one.</p>
              )}
            </div>
          )}

          {/* Projects — hidden for sales role */}
          {currentUser?.role !== 'sales' && (
          <div className="rounded-xl border border-gray-800 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Projects ({client.projects?.length || 0})</h2>
              <button
                onClick={() => {
                  setEditProject(null);
                  setShowProjectForm(true);
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                + Add Project
              </button>
            </div>
            {!Array.isArray(client.projects) || !client.projects.length ? (
              <p className="text-sm text-gray-500">No projects yet.</p>
            ) : (
              <div className="space-y-3">
                {client.projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onEdit={() => {
                      setEditProject(p);
                      setShowProjectForm(true);
                    }}
                    onDelete={async () => {
                      if (!confirm('Delete this project?')) return;
                      try {
                        await api.delete(`/projects/${p.id}`);
                        toast.success('Project deleted');
                        fetchClient();
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Delete failed');
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          )} {/* end sales role guard */}
        </div>

        {/* Sidebar: Portal Access + Files + Notes */}
        <div className="space-y-6">
          <PortalAccessCard client={client} onUpdate={fetchClient} />
          <FileSection clientId={client.id} files={client.files} onUpdate={fetchClient} />
          <NotesSection clientId={client.id} />
        </div>
      </div>

      {/* Edit Client Modal */}
      <EditClientModal
        open={editing}
        client={client}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          fetchClient();
        }}
      />

      {/* Project Form Modal */}
      <ProjectFormModal
        open={showProjectForm}
        project={editProject}
        clientId={client.id}
        onClose={() => setShowProjectForm(false)}
        onSaved={() => {
          setShowProjectForm(false);
          fetchClient();
        }}
      />
    </div>
  );
}

/* --- Sub-components --- */

function InfoItem({ label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-200">{value || '—'}</dd>
    </div>
  );
}

function PortalAccessCard({ client, onUpdate }) {
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);

  const searchUsers = async (q) => {
    setSearching(true);
    try {
      const r = await api.get('/clients/portal-users', { params: { search: q } });
      setCandidates(Array.isArray(r.data) ? r.data : []);
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (linking) searchUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linking]);

  const handleLink = async (portalUserId) => {
    try {
      await api.put(`/clients/${client.id}/portal-link`, { portalUserId });
      toast.success('Portal login linked');
      setLinking(false);
      setSearch('');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to link portal login');
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Remove the portal login link for this client?')) return;
    try {
      await api.put(`/clients/${client.id}/portal-link`, { portalUserId: null });
      toast.success('Portal login unlinked');
      onUpdate();
    } catch {
      toast.error('Failed to unlink');
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-surface p-5">
      <h2 className="mb-3 text-lg font-semibold">Portal Access</h2>
      {client.portalUser ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-200">{client.portalUser.name}</p>
            <p className="text-xs text-gray-500">{client.portalUser.email}</p>
            {!client.portalUser.isActive && (
              <span className="mt-1 inline-block rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-400">Deactivated</span>
            )}
          </div>
          {client.portalTicketSummary && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-400">{client.portalTicketSummary.pending} pending</span>
              <span className="rounded-full bg-blue-500/10 px-2 py-1 text-blue-400">{client.portalTicketSummary.in_progress} in progress</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-400">{client.portalTicketSummary.complete} complete</span>
            </div>
          )}
          <button onClick={handleUnlink} className="text-xs text-gray-500 hover:text-red-400">
            Unlink portal login
          </button>
        </div>
      ) : linking ? (
        <div className="space-y-2">
          <input
            autoFocus
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              searchUsers(e.target.value);
            }}
            className="w-full rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {searching && <p className="text-xs text-gray-500">Searching…</p>}
            {!searching && candidates.length === 0 && <p className="text-xs text-gray-500">No client portal accounts found.</p>}
            {candidates.map((c) => (
              <button
                key={c.id}
                disabled={!!c.linked_client_id}
                onClick={() => handleLink(c.id)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-lighter disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>
                  <span className="block text-gray-200">{c.name}</span>
                  <span className="text-gray-500">{c.email}</span>
                </span>
                {c.linked_client_id && <span className="text-gray-600">linked elsewhere</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setLinking(false)} className="text-xs text-gray-500 hover:text-gray-300">
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-gray-500">No ticket-portal login linked to this client yet.</p>
          <button onClick={() => setLinking(true)} className="text-sm text-brand-400 hover:underline">
            + Link a portal login
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete }) {
  const statusColor = {
    active: 'bg-emerald-500/20 text-emerald-400',
    complete: 'bg-blue-500/20 text-blue-400',
    'on-hold': 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="rounded-lg border border-gray-800 p-4 transition hover:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{project.name}</h3>
          {project.description && (
            <p className="mt-1 text-sm text-gray-400 line-clamp-2">{project.description}</p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[project.status] || 'bg-gray-700 text-gray-400'}`}>
          {project.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>{new Date(project.startDate).toLocaleDateString()}</span>
        <span>→</span>
        <span>{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Ongoing'}</span>
        {project.milestones?.length > 0 && (
          <span className="text-brand-400">{project.milestones.length} milestones</span>
        )}
      </div>
      {Array.isArray(project.milestones) && project.milestones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {project.milestones.map((m) => (
            <span key={m.id} className="rounded bg-surface-lighter px-2 py-0.5 text-xs text-gray-400">
              {m.title} — {new Date(m.date).toLocaleDateString()}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(project.assignedUsers) && project.assignedUsers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500">Assigned:</span>
          {project.assignedUsers.map((u) => (
            <span key={u.id} className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {u.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={onEdit} className="text-xs text-brand-400 hover:underline">
          Edit
        </button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function isImage(f) {
  const name = f.filename?.toLowerCase() || '';
  const mime = f.mimetype || '';
  return mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/.test(name);
}

function isViewable(f) {
  const name = f.filename?.toLowerCase() || '';
  const mime = f.mimetype || '';
  return mime === 'application/pdf' || name.endsWith('.pdf') || isImage(f);
}

function FileViewerModal({ file, onClose }) {
  if (!file) return null;
  const image = isImage(file);
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 flex flex-col w-full h-full mx-auto my-6 rounded-xl border border-gray-800 bg-gray-950 shadow-2xl overflow-hidden ${image ? 'max-w-4xl' : 'max-w-5xl'}`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {image ? (
              <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
              </svg>
            )}
            <span className="text-sm font-medium text-gray-200 truncate">{file.filename}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <a href={`/api/files/${file.id}/download`} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-surface-lighter">
              Download
            </a>
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-surface-lighter hover:text-gray-300" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {image ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto">
            <img
              src={`/api/files/${file.id}/view`}
              alt={file.filename}
              className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            />
          </div>
        ) : (
          <iframe src={`/api/files/${file.id}/view`} title={file.filename} className="flex-1 w-full border-0 bg-gray-900" />
        )}
      </div>
    </div>
  );
}

function FileSection({ clientId, files, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // isViewable and isImage are defined above FileSection

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/clients/${clientId}/files`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File uploaded');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('File deleted');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gray-800 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Files ({files?.length || 0})</h2>
          <label className="cursor-pointer rounded-lg bg-surface-lighter px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600">
            {uploading ? 'Uploading…' : '+ Upload'}
            <input type="file" className="hidden" accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.gif" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {!files?.length ? (
          <p className="text-sm text-gray-500">No files uploaded.</p>
        ) : (
          <ul className="space-y-2">
            {(files || []).map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-light">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  {isImage(f) ? (
                    <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  ) : isViewable(f) ? (
                    <svg className="h-4 w-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-200">{f.filename}</p>
                    <p className="text-xs text-gray-500">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  {isViewable(f) && (
                    <button
                      onClick={() => setPreviewFile(f)}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      View
                    </button>
                  )}
                  <a
                    href={`/api/files/${f.id}/download`}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    Download
                  </a>
                  <button onClick={() => handleDelete(f.id)} className="text-xs text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewFile && (
        <FileViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}

function EditClientModal({ open, client, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', address: '', notes: '', tags: [], hostingTier: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || '',
        company: client.company || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
        tags: client.tags || [],
        hostingTier: client.hostingTier || '',
      });
    }
  }, [client]);

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
      await api.put(`/clients/${client.id}`, {
        ...form,
        hostingTier: form.tags.includes('Website Hosting') ? form.hostingTier || null : null,
      });
      toast.success('Client updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Client" wide>
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
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectFormModal({ open, project, clientId, onClose, onSaved }) {
  const isEdit = !!project;
  const [form, setForm] = useState({ name: '', description: '', status: 'active', startDate: '', endDate: '', milestones: [], assignedUserIds: [] });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  // Load user list when modal opens
  useEffect(() => {
    if (open) {
      api.get('/users').then((r) => setUsers(r.data)).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'active',
        startDate: project.startDate ? project.startDate.slice(0, 10) : '',
        endDate: project.endDate ? project.endDate.slice(0, 10) : '',
        milestones: Array.isArray(project.milestones)
          ? project.milestones.map((m) => ({ title: m.title, date: m.date.slice(0, 10) }))
          : [],
        assignedUserIds: Array.isArray(project.assignedUsers)
          ? project.assignedUsers.map((u) => u.id)
          : [],
      });
    } else {
      setForm({ name: '', description: '', status: 'active', startDate: '', endDate: '', milestones: [], assignedUserIds: [] });
    }
  }, [project, open]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleUser = (uid) => {
    const next = form.assignedUserIds.includes(uid)
      ? form.assignedUserIds.filter((id) => id !== uid)
      : [...form.assignedUserIds, uid];
    setForm({ ...form, assignedUserIds: next });
  };

  const addMilestone = () => setForm({ ...form, milestones: [...(form.milestones || []), { title: '', date: '' }] });
  const removeMilestone = (i) => setForm({ ...form, milestones: (form.milestones || []).filter((_, idx) => idx !== i) });
  const setMilestone = (i, field, val) => {
    const ms = [...form.milestones];
    ms[i] = { ...ms[i], [field]: val };
    setForm({ ...form, milestones: ms });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        clientId,
        milestones: (form.milestones || []).filter((m) => m.title && m.date),
      };
      if (isEdit) {
        await api.put(`/projects/${project.id}`, payload);
        toast.success('Project updated');
      } else {
        await api.post('/projects', payload);
        toast.success('Project created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Project' : 'New Project'} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Project Name *" value={form.name} onChange={set('name')} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={set('description')}
            className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Status</label>
            <select
              value={form.status}
              onChange={set('status')}
              className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <Input label="Start Date *" type="date" value={form.startDate} onChange={set('startDate')} required />
          <Input label="End Date" type="date" value={form.endDate} onChange={set('endDate')} />
        </div>

        {/* Assigned Users */}
        {Array.isArray(users) && users.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Assigned Staff</label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const active = form.assignedUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300'
                        : 'border-gray-700 bg-surface-light text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {active && <span className="mr-1">✓</span>}
                    {u.name}
                    <span className="ml-1 opacity-50">{u.role === 'admin' ? '(admin)' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Milestones */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Milestones</label>
            <button type="button" onClick={addMilestone} className="text-xs text-brand-400 hover:underline">
              + Add Milestone
            </button>
          </div>
          {(form.milestones || []).map((m, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                placeholder="Title"
                value={m.title}
                onChange={(e) => setMilestone(i, 'title', e.target.value)}
                className="flex-1 rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="date"
                value={m.date}
                onChange={(e) => setMilestone(i, 'date', e.target.value)}
                className="rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
              />
              <button type="button" onClick={() => removeMilestone(i)} className="text-red-400 hover:text-red-300 px-1">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NotesSection({ clientId }) {
  const { user: currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState(null); // note being edited
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const loadNotes = () => {
    api.get(`/clients/${clientId}/notes`)
      .then((r) => setNotes(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  };

  useEffect(() => { loadNotes(); }, [clientId]);

  const openNew = () => {
    setEditNote(null);
    setForm({ title: '', content: '' });
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditNote(note);
    setForm({ title: note.title || '', content: note.content || '' });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditNote(null);
    setForm({ title: '', content: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return toast.error('Note content is required');
    setSaving(true);
    try {
      if (editNote) {
        await api.put(`/notes/${editNote.id}`, { title: form.title, content: form.content });
        toast.success('Note updated');
      } else {
        await api.post(`/clients/${clientId}/notes`, { title: form.title, content: form.content });
        toast.success('Note saved');
      }
      closeForm();
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/notes/${noteId}`);
      toast.success('Note deleted');
      loadNotes();
    } catch {
      toast.error('Failed to delete note');
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notes ({notes.length})</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-surface-lighter px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600"
        >
          + Add Note
        </button>
      </div>

      {/* Compose / edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="mb-4 rounded-lg border border-brand-600/30 bg-surface-light p-3 space-y-2">
          <input
            placeholder="Title (optional)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-gray-700 bg-surface px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          />
          <textarea
            rows={4}
            placeholder="Write your note…"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            required
            className="w-full rounded-md border border-gray-700 bg-surface px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none resize-y"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editNote ? 'Update Note' : 'Save Note'}
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 && !showForm ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-gray-800 p-3 hover:border-gray-700 transition">
              {note.title && (
                <p className="mb-1 text-sm font-semibold text-gray-200">{note.title}</p>
              )}
              <p className="whitespace-pre-wrap text-sm text-gray-300">{note.content}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {note.author && (
                    <>
                      <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-indigo-300">{note.author.name}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                  {note.updatedAt !== note.createdAt && (
                    <span className="text-gray-600">(edited)</span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(note)} className="text-xs text-brand-400 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(note.id)} className="text-xs text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
