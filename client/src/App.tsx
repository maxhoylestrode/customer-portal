import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './store/authStore';
import { authApi } from './api/auth';
import { User } from './types';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute, PublicRoute } from './router';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Client pages
import ClientDashboard from './pages/client/Dashboard';
import TicketsPage from './pages/client/TicketsPage';
import NewTicketPage from './pages/client/NewTicketPage';
import TicketDetailPage from './pages/client/TicketDetailPage';
import ProfilePage from './pages/client/ProfilePage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

// Misc
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authApi.getMe()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser }}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Password reset (always accessible) */}
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Client routes */}
            <Route element={<ProtectedRoute requiredRole="client" />}>
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<NewTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/tickets" element={<AdminTicketsPage />} />
              <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/accounts" element={<AdminAccountsPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
