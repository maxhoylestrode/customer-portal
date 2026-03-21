import api from './axios';
import { Ticket, Attachment, TicketActivity } from '../types';

export const ticketsApi = {
  getAll: (params?: { status?: string; scope_flag?: string; client_id?: number }) =>
    api.get<{ tickets: Ticket[] }>('/tickets', { params }),

  getById: (id: number) =>
    api.get<{ ticket: Ticket; attachments: Attachment[]; activity: TicketActivity[] }>(`/tickets/${id}`),

  create: (formData: FormData) =>
    api.post<{ ticket: Ticket }>('/tickets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: Partial<Ticket>) =>
    api.patch<{ ticket: Ticket }>(`/tickets/${id}`, data),

  delete: (id: number) => api.delete(`/tickets/${id}`),

  uploadAttachment: (ticketId: number, formData: FormData) =>
    api.post<{ attachments: Attachment[] }>(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAttachment: (ticketId: number, attachmentId: number) =>
    api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`),
};
