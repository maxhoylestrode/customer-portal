import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import api from '../api/axios';

interface SearchResult {
  id: string | number;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResults {
  clients: SearchResult[];
  tickets: SearchResult[];
  notes: SearchResult[];
  projects: SearchResult[];
}

const EMPTY: SearchResults = { clients: [], tickets: [], notes: [], projects: [] };

const GROUP_LABELS: Record<keyof SearchResults, string> = {
  clients: 'Clients',
  tickets: 'Tickets',
  notes: 'Notes',
  projects: 'Projects',
};

export default function GlobalSearch({ dark }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults(EMPTY);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<SearchResults>('/search', { params: { q: query } })
        .then((r) => setResults(r.data))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function goTo(url: string) {
    setOpen(false);
    navigate(url);
  }

  const groups = (Object.keys(results) as (keyof SearchResults)[]).filter((k) => results[k].length > 0);
  const hasResults = groups.length > 0;
  const searched = query.trim().length >= 2;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          dark
            ? 'bg-surface-light text-gray-400 hover:text-gray-200'
            : 'bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white'
        }`}
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-[10px] opacity-60">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative z-10 w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients, tickets, notes, projects…"
                className="flex-1 outline-none text-sm text-[#0D3040] placeholder:text-gray-400"
              />
              <button onClick={() => setOpen(false)} aria-label="Close search">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-sm text-gray-400">Searching…</p>}
              {!loading && searched && !hasResults && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">No results for "{query}"</p>
              )}
              {!loading && !searched && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Type at least 2 characters to search</p>
              )}
              {!loading &&
                groups.map((key) => (
                  <div key={key} className="py-2">
                    <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {GROUP_LABELS[key]}
                    </p>
                    {results[key].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => goTo(r.url)}
                        className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-gray-50"
                      >
                        <span className="text-sm font-medium text-[#0D3040]">{r.title}</span>
                        <span className="text-xs text-gray-400">{r.subtitle}</span>
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
