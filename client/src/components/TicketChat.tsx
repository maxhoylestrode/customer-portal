import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/tickets';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { formatDateTime } from '../utils/formatters';
import { MessageCircle, Send } from 'lucide-react';

const POLL_INTERVAL_MS = 4000;

export default function TicketChat({ ticketId }: { ticketId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => ticketsApi.getMessages(ticketId),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const messages = data?.data.messages || [];

  const sendMutation = useMutation({
    mutationFn: (message: string) => ticketsApi.sendMessage(ticketId, message),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send message';
      toast(msg, 'error');
    },
  });

  // Auto-scroll to the latest message when the thread grows
  const lastCount = useRef(0);
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: lastCount.current === 0 ? 'auto' : 'smooth' });
      lastCount.current = messages.length;
    }
  }, [messages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  return (
    <div className="card px-5 py-5">
      <h3 className="font-semibold text-[#0D3040] mb-3 text-sm flex items-center gap-2">
        <MessageCircle className="w-4 h-4" />
        Messages
      </h3>

      <div ref={listRef} className="max-h-96 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const isMine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-[#0D3040] text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMine && (
                  <p className={`text-xs font-medium mb-0.5 ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>{m.author_name}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`text-[11px] mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>{formatDateTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-gray-100 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          rows={1}
          className="input resize-none flex-1 py-2"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="btn-primary flex items-center justify-center p-2.5 shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
