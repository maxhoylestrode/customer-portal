import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ACCEPTED = '.pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.csv,.xlsx,.zip';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

/* ── FileTypeIcon ─────────────────────────────────────────────────────────── */
function FileTypeIcon({ mimetype, filename }) {
  const name = filename?.toLowerCase() || '';
  const mime = mimetype || '';

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
        <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
        </svg>
      </div>
    );
  }
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/.test(name)) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }
  if (/\.(doc|docx)$/.test(name) || mime.includes('word')) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
        <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 5h4v1h-4v-1zm0-2h6v1h-6v-1zm0 4h4v1h-4v-1z" />
        </svg>
      </div>
    );
  }
  if (/\.(csv|xlsx)$/.test(name) || mime.includes('spreadsheet') || mime.includes('csv')) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/15">
        <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125H2.25m13.125 0h1.5c.621 0 1.125-.504 1.125-1.125M18.75 19.5h1.875a1.875 1.875 0 00-1.875-1.875m0 0v-14.25M5.25 6a1.875 1.875 0 00-1.875 1.875v9.75A1.875 1.875 0 005.25 19.5m0-13.5h13.5A1.875 1.875 0 0120.625 7.875v9.75" />
        </svg>
      </div>
    );
  }
  if (name.endsWith('.zip') || mime.includes('zip')) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
        <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-700/50">
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </div>
  );
}

/* ── PermissionBadge ──────────────────────────────────────────────────────── */
function PermissionBadge({ file }) {
  if (file.shareMode === 'none') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-400">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Private
      </span>
    );
  }
  if (file.shareMode === 'specific') {
    const count = file.accessList?.length || 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 px-2 py-0.5 text-[11px] text-indigo-300">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        {count} {count === 1 ? 'person' : 'people'}
      </span>
    );
  }
  // everyone
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/30 px-2 py-0.5 text-[11px] text-emerald-400">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
      Everyone
    </span>
  );
}

/* ── FileViewerModal ──────────────────────────────────────────────────────── */
function FileViewerModal({ file, onClose, apiBase }) {
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
              </svg>
            )}
            <span className="text-sm font-medium text-gray-200 truncate">{file.filename}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <a href={`${apiBase}/${file.id}/download`} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-surface-lighter">
              Download
            </a>
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-surface-lighter hover:text-gray-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {image ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto">
            <img src={`${apiBase}/${file.id}/view`} alt={file.filename} className="max-h-full max-w-full rounded-lg object-contain shadow-lg" />
          </div>
        ) : (
          <iframe src={`${apiBase}/${file.id}/view`} title={file.filename} className="flex-1 w-full border-0 bg-gray-900" />
        )}
      </div>
    </div>
  );
}

/* ── UserSelector ─────────────────────────────────────────────────────────── */
function UserSelector({ users, selected, onChange, excludeId }) {
  const [search, setSearch] = useState('');
  const available = users.filter(
    (u) => u.id !== excludeId && (
      !search || u.name.toLowerCase().includes(search.toLowerCase())
    )
  );

  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900">
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <ul className="max-h-40 overflow-y-auto divide-y divide-gray-800">
        {available.length === 0 && <li className="px-3 py-2 text-xs text-gray-500">No users found</li>}
        {available.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-800/50">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="accent-brand-500"
              />
              <span className="text-xs text-gray-200">{u.name}</span>
              <span className="ml-auto text-[10px] text-gray-500 capitalize">{u.role}</span>
            </label>
          </li>
        ))}
      </ul>
      {selected.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-700 text-[11px] text-gray-400">
          {selected.length} user{selected.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

/* ── EditPermissionsModal ─────────────────────────────────────────────────── */
function EditPermissionsModal({ file, users, meId, meRole, onClose, onSaved }) {
  const [shareMode, setShareMode] = useState(file.shareMode || 'everyone');
  const [selectedUsers, setSelectedUsers] = useState(
    (file.accessList || []).map((a) => a.userId || a.user?.id).filter(Boolean)
  );
  const [saving, setSaving] = useState(false);

  const canEdit = meRole === 'admin' || file.uploadedBy === meId;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/storage/${file.id}/permissions`, {
        shareMode,
        userIds: shareMode === 'specific' ? selectedUsers : [],
      });
      toast.success('Permissions updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-800 bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">File Permissions</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-surface-lighter hover:text-gray-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2">
          <FileTypeIcon mimetype={file.mimetype} filename={file.filename} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-200">{file.filename}</p>
            <p className="text-xs text-gray-500">{file.folder}</p>
          </div>
        </div>

        {!canEdit ? (
          <p className="text-sm text-gray-400 py-4 text-center">Only the uploader or an admin can change permissions.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Who can see this file?</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'everyone', icon: '🌐', label: 'Everyone' },
                  { value: 'specific', icon: '👥', label: 'Specific' },
                  { value: 'none',     icon: '🔒', label: 'Private' },
                ].map(({ value, icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShareMode(value)}
                    className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition ${
                      shareMode === value
                        ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{icon}</div>
                    <div className="text-xs">{label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-xs text-gray-500">
                {shareMode === 'everyone' && 'All team members can see this file.'}
                {shareMode === 'none' && 'Only you (and admins) can see this file.'}
                {shareMode === 'specific' && 'Only the selected users (and admins) can see this file.'}
              </div>
            </div>

            {shareMode === 'specific' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Select users</label>
                <UserSelector
                  users={users}
                  selected={selectedUsers}
                  onChange={setSelectedUsers}
                  excludeId={meId}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── UploadModal ──────────────────────────────────────────────────────────── */
function UploadModal({ open, folders, users, meId, onClose, onUploaded }) {
  const [files, setFiles]           = useState([]);     // File[]
  const [folder, setFolder]         = useState('General');
  const [newFolder, setNewFolder]   = useState('');
  const [shareMode, setShareMode]   = useState('everyone');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const inputRef = useRef(null);

  const reset = () => {
    setFiles([]);
    setFolder('General');
    setNewFolder('');
    setShareMode('everyone');
    setSelectedUsers([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };
  const activeFolder = folder === '__new__' ? newFolder.trim() : folder;

  const addFiles = (incoming) => {
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const deduped = Array.from(incoming).filter((f) => !names.has(f.name));
      return [...prev, ...deduped];
    });
  };

  const removeFile = (name) => setFiles((f) => f.filter((x) => x.name !== name));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) return toast.error('Please select at least one file');
    if (!activeFolder)  return toast.error('Please enter a folder name');
    if (shareMode === 'specific' && selectedUsers.length === 0) {
      return toast.error('Please select at least one user for specific sharing');
    }

    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('folder', activeFolder);
      fd.append('shareMode', shareMode);
      if (shareMode === 'specific') fd.append('userIds', JSON.stringify(selectedUsers));
      await api.post('/storage', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
      reset();
      onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-gray-800 bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload Files</h2>
          <button onClick={handleClose} className="rounded-md p-1 text-gray-500 hover:bg-surface-lighter hover:text-gray-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition cursor-pointer ${
              dragOver
                ? 'border-brand-400 bg-brand-600/10'
                : files.length
                ? 'border-brand-600 bg-brand-600/5'
                : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            {files.length === 0 ? (
              <>
                <svg className="mb-2 h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-gray-300">Drag & drop files here</p>
                <p className="text-xs text-gray-500 mt-1">or click to browse — PDF, DOCX, images, CSV up to 50 MB</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-200 mb-1">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
                <p className="text-xs text-gray-500">Click or drop to add more</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }}
            />
          </div>

          {/* File queue */}
          {files.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-800">
                  <FileTypeIcon mimetype={f.type} filename={f.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-200">{f.name}</p>
                    <p className="text-[10px] text-gray-500">{formatBytes(f.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                    className="text-gray-600 hover:text-red-400 transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Folder */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Folder</label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ Create new folder…</option>
            </select>
            {folder === '__new__' && (
              <input
                autoFocus
                placeholder="Folder name"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Share mode */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Who can see these files?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'everyone', icon: '🌐', label: 'Everyone' },
                { value: 'specific', icon: '👥', label: 'Specific' },
                { value: 'none',     icon: '🔒', label: 'Private' },
              ].map(({ value, icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setShareMode(value)}
                  className={`rounded-lg border px-3 py-2.5 text-center transition ${
                    shareMode === value
                      ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <div className="text-base mb-0.5">{icon}</div>
                  <div className="text-xs font-medium">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* User selector (specific mode) */}
          {shareMode === 'specific' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Select users</label>
              <UserSelector
                users={users}
                selected={selectedUsers}
                onChange={setSelectedUsers}
                excludeId={meId}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {uploading ? 'Uploading…' : `Upload ${files.length > 1 ? `${files.length} Files` : 'File'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── FolderCard ───────────────────────────────────────────────────────────── */
function FolderCard({ name, files, onClick }) {
  const count = files.length;
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-gray-800 bg-surface p-4 text-left transition hover:border-brand-600/50 hover:bg-surface-light"
    >
      <div className="flex items-center gap-3 w-full">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
          <svg className="h-6 w-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-200 group-hover:text-white">{name}</p>
          <p className="text-xs text-gray-500">{count} file{count !== 1 ? 's' : ''} · {formatBytes(totalSize)}</p>
        </div>
        <svg className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      {/* Preview of first 3 files */}
      {count > 0 && (
        <div className="flex flex-wrap gap-1 w-full mt-1">
          {files.slice(0, 3).map((f) => (
            <span key={f.id} className="flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 max-w-[140px] truncate">
              <span className="truncate">{f.filename}</span>
            </span>
          ))}
          {count > 3 && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">+{count - 3} more</span>
          )}
        </div>
      )}
    </button>
  );
}

/* ── FilesPage ────────────────────────────────────────────────────────────── */
export default function FilesPage() {
  const { user: me } = useAuth();
  const [files, setFiles]               = useState([]);
  const [folders, setFolders]           = useState(['General']);
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [activeFolder, setActiveFolder] = useState('');
  const [viewMode, setViewMode]         = useState('folders'); // 'folders' | 'list'
  const [sort, setSort]                 = useState('date');
  const [sortDir, setSortDir]           = useState('desc');
  const [showUpload, setShowUpload]     = useState(false);
  const [previewFile, setPreviewFile]   = useState(null);
  const [editPermFile, setEditPermFile] = useState(null);

  const fetchFiles = useCallback(async () => {
    try {
      const params = { sort, dir: sortDir };
      if (search) params.search = search;
      if (activeFolder) params.folder = activeFolder;
      const [filesRes, foldersRes] = await Promise.all([
        api.get('/storage', { params }),
        api.get('/storage/folders'),
      ]);
      setFiles(Array.isArray(filesRes.data) ? filesRes.data : []);
      const f = Array.isArray(foldersRes.data) ? foldersRes.data : [];
      setFolders(['General', ...f.filter((x) => x !== 'General')]);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [search, activeFolder, sort, sortDir]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Load users for permission management
  useEffect(() => {
    api.get('/users').then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this file permanently?')) return;
    try {
      await api.delete(`/storage/${id}`);
      toast.success('File deleted');
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const toggleSort = (field) => {
    if (sort === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(field); setSortDir('desc'); }
  };

  const SortButton = ({ field, label }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
        sort === field ? 'bg-brand-600/20 text-brand-300' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
      {sort === field && (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          {sortDir === 'asc'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />}
        </svg>
      )}
    </button>
  );

  // Group files by folder for folder view
  const filesByFolder = files.reduce((acc, f) => {
    const key = f.folder || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const canModifyFile = (f) => me?.role === 'admin' || f.uploadedBy === me?.id;

  // Determine current view
  const showFolderCards = viewMode === 'folders' && !activeFolder && !search;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="mt-1 text-sm text-gray-500">Team storage — upload, organise, and share files.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload Files
        </button>
      </div>

      {/* Controls row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-surface pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-surface px-2 py-1">
          <span className="text-xs text-gray-500 mr-1">Sort:</span>
          <SortButton field="date" label="Date" />
          <SortButton field="name" label="Name" />
          <SortButton field="size" label="Size" />
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => { setViewMode('folders'); setActiveFolder(''); }}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'folders' ? 'bg-brand-600 text-white' : 'bg-surface text-gray-400 hover:text-gray-200'}`}
            title="Folder view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-surface text-gray-400 hover:text-gray-200'}`}
            title="List view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Breadcrumb when inside a folder */}
      {activeFolder && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setActiveFolder('')}
            className="text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            All Files
          </button>
          <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-gray-200 font-medium">{activeFolder}</span>
          <span className="text-gray-500 text-xs">({files.length} file{files.length !== 1 ? 's' : ''})</span>
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : showFolderCards ? (
        /* ── Folder Grid View ── */
        <div>
          {Object.keys(filesByFolder).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-xl border border-gray-800 bg-surface">
              <svg className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <p className="text-gray-500">No files uploaded yet.</p>
              <button onClick={() => setShowUpload(true)} className="text-sm text-brand-400 hover:underline">
                Upload your first file
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(filesByFolder).map(([folderName, folderFiles]) => (
                <FolderCard
                  key={folderName}
                  name={folderName}
                  files={folderFiles}
                  onClick={() => { setActiveFolder(folderName); setViewMode('list'); }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── List View ── */
        <div className="rounded-xl border border-gray-800 bg-surface">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <svg className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-gray-500">{search || activeFolder ? 'No files match your filters.' : 'No files in this folder.'}</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-gray-800 px-5 py-3 text-xs font-medium text-gray-500">
                <span className="w-9" />
                <span>Name</span>
                <span className="hidden sm:block w-24">Folder</span>
                <span className="hidden lg:block w-28">Access</span>
                <span className="hidden md:block w-20">Size</span>
                <span className="hidden lg:block w-32">Uploaded</span>
                <span className="w-32 text-right">Actions</span>
              </div>
              <ul className="divide-y divide-gray-800/60">
                {files.map((f) => (
                  <li key={f.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-3 hover:bg-surface-light transition">
                    <FileTypeIcon mimetype={f.mimetype} filename={f.filename} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-200">{f.filename}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.uploader?.name || 'Unknown'}</p>
                    </div>
                    <span className="hidden sm:block w-24">
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400 truncate max-w-[6rem] inline-block">{f.folder}</span>
                    </span>
                    <span className="hidden lg:block w-28">
                      <PermissionBadge file={f} />
                    </span>
                    <span className="hidden md:block w-20 text-xs text-gray-500">{formatBytes(f.size)}</span>
                    <span className="hidden lg:block w-32 text-xs text-gray-500">{new Date(f.uploadedAt).toLocaleDateString()}</span>
                    <div className="flex items-center justify-end gap-2 w-32">
                      {isViewable(f) && (
                        <button onClick={() => setPreviewFile(f)} className="text-xs text-indigo-400 hover:underline">View</button>
                      )}
                      <a href={`/api/storage/${f.id}/download`} className="text-xs text-brand-400 hover:underline">Download</a>
                      {canModifyFile(f) && (
                        <>
                          <button onClick={() => setEditPermFile(f)} className="text-xs text-yellow-400 hover:underline" title="Edit permissions">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(f.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        open={showUpload}
        folders={folders}
        users={users}
        meId={me?.id}
        onClose={() => setShowUpload(false)}
        onUploaded={() => { setShowUpload(false); fetchFiles(); }}
      />

      {previewFile && (
        <FileViewerModal file={previewFile} onClose={() => setPreviewFile(null)} apiBase="/api/storage" />
      )}

      {editPermFile && (
        <EditPermissionsModal
          file={editPermFile}
          users={users}
          meId={me?.id}
          meRole={me?.role}
          onClose={() => setEditPermFile(null)}
          onSaved={fetchFiles}
        />
      )}
    </div>
  );
}
