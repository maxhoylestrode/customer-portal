import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];
const colorFromId = (id) => PALETTE[(id ?? 0) % PALETTE.length];

export default function NotesPage() {
  const { user: currentUser } = useAuth();
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('all'); // 'all' | 'mine'
  const [showForm, setShowForm]     = useState(false);
  const [editNote, setEditNote]     = useState(null);
  const [search, setSearch]         = useState('');
  const [form, setForm]             = useState({ title: '', content: '', isPrivate: false });
  const [saving, setSaving]         = useState(false);

  const loadNotes = () => {
    api.get('/general-notes')
      .then((r) => setNotes(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load notes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotes(); }, []);

  const openNew = () => {
    setEditNote(null);
    setForm({ title: '', content: '', isPrivate: false });
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditNote(note);
    setForm({ title: note.title || '', content: note.content || '', isPrivate: note.isPrivate });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditNote(null);
    setForm({ title: '', content: '', isPrivate: false });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return toast.error('Content is required');
    setSaving(true);
    try {
      if (editNote) {
        await api.put(`/general-notes/${editNote.id}`, form);
        toast.success('Note updated');
      } else {
        await api.post('/general-notes', form);
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
      await api.delete(`/general-notes/${noteId}`);
      toast.success('Note deleted');
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const canEdit = (note) =>
    note.author?.id === currentUser?.id || currentUser?.role === 'admin';

  // Filter notes
  const filtered = notes.filter((n) => {
    if (tab === 'mine' && n.author?.id !== currentUser?.id) return false;
    if (tab === 'all' && n.isPrivate && n.author?.id !== currentUser?.id) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        n.title?.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.author?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const publicCount = notes.filter((n) => !n.isPrivate).length;
  const myCount     = notes.filter((n) => n.author?.id === currentUser?.id).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">Shared team notes and personal private notes.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Note
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-lg border border-gray-800 bg-surface p-1 gap-1">
          {[
            { key: 'all',  label: `Everyone (${publicCount})` },
            { key: 'mine', label: `My Notes (${myCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === key
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-surface pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Compose / edit form */}
      {showForm && (
        <NoteForm
          form={form}
          setForm={setForm}
          editNote={editNote}
          saving={saving}
          onSubmit={handleSave}
          onClose={closeForm}
        />
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-surface py-16 text-center">
          <svg className="mb-3 h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          <p className="text-gray-500">
            {search ? 'No notes match your search.' : tab === 'mine' ? 'You haven\'t created any notes yet.' : 'No shared notes yet. Be the first!'}
          </p>
          {!search && (
            <button onClick={openNew} className="mt-3 text-sm text-brand-400 hover:underline">
              Create a note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={currentUser?.id}
              canEdit={canEdit(note)}
              onEdit={() => openEdit(note)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, currentUserId, canEdit, onEdit, onDelete }) {
  const isOwn = note.author?.id === currentUserId;
  const authorColor = colorFromId(note.author?.id);

  return (
    <div className={`group relative flex flex-col rounded-xl border bg-surface p-5 transition hover:border-gray-600 ${
      note.isPrivate ? 'border-indigo-800/50' : 'border-gray-800'
    }`}>
      {/* Privacy badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {note.isPrivate ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Private
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Shared
            </span>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onEdit} className="rounded p-1 text-gray-500 hover:bg-surface-lighter hover:text-brand-400" title="Edit">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
            <button onClick={onDelete} className="rounded p-1 text-gray-500 hover:bg-red-900/30 hover:text-red-400" title="Delete">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {note.title && (
        <h3 className="mb-2 font-semibold text-gray-100 leading-snug">{note.title}</h3>
      )}
      <p className="flex-1 whitespace-pre-wrap text-sm text-gray-300 leading-relaxed line-clamp-6">{note.content}</p>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-gray-800/60">
        {note.author ? (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white uppercase"
            style={{ backgroundColor: authorColor }}
            title={note.author.name}
          >
            {note.author.name[0]}
          </div>
        ) : (
          <div className="h-6 w-6 shrink-0 rounded-full bg-gray-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-gray-400">{note.author?.name || 'Unknown'}{isOwn && <span className="ml-1 text-gray-600">(you)</span>}</p>
          <p className="text-xs text-gray-600">{new Date(note.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ── Note Form ─────────────────────────────────────────────────────────────────
function NoteForm({ form, setForm, editNote, saving, onSubmit, onClose }) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-brand-700/40 bg-surface p-5 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-200">{editNote ? 'Edit Note' : 'New Note'}</h2>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <input
        placeholder="Title (optional)"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="w-full rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
      />
      <textarea
        rows={5}
        placeholder="Write your note…"
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
        required
        className="w-full resize-y rounded-lg border border-gray-700 bg-surface-light px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
      />
      {/* Visibility toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-surface-light px-4 py-2.5">
        <button
          type="button"
          onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            form.isPrivate ? 'bg-indigo-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.isPrivate ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-200">
            {form.isPrivate ? 'Private note' : 'Shared with everyone'}
          </p>
          <p className="text-xs text-gray-500">
            {form.isPrivate ? 'Only you can see this' : 'All staff members can see this'}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : editNote ? 'Update Note' : 'Save Note'}
        </button>
      </div>
    </form>
  );
}
