import api from './axios';
import { User, DashboardStats, TicketActivity } from '../types';

export const adminApi = {
  getStats: () =>
    api.get<{ stats: DashboardStats; recentActivity: TicketActivity[] }>('/admin/stats'),

  getUsers: () => api.get<{ users: User[] }>('/admin/users'),

  getUser: (id: number) =>
    api.get<{ user: User; stats: { pending: number; in_progress: number; complete: number; total: number } }>(
      `/admin/users/${id}`
    ),

  createUser: (data: {
    name: string;
    email: string;
    phone?: string;
    company_name?: string;
    website_url?: string;
    client_notes?: string;
  }) => api.post<{ user: User }>('/admin/users', data),

  updateUser: (id: number, data: Partial<User>) =>
    api.patch<{ user: User }>(`/admin/users/${id}`, data),

  sendInvite: (email: string, name?: string) =>
    api.post('/admin/users/invite', { email, name }),

  sendPasswordReset: (userId: number) =>
    api.post(`/admin/users/${userId}/reset-password`),
};
