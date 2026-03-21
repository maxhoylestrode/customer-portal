import api from './axios';
import { User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { email, password }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    company_name?: string;
    website_url?: string;
    invite: string;
  }) => api.post<{ user: User }>('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get<{ user: User }>('/auth/me'),

  resetPasswordConfirm: (token: string, password: string) =>
    api.post('/auth/reset-password/confirm', { token, password }),
};
