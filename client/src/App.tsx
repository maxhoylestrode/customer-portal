import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthContext } from './store/authStore';
import { authApi } from './api/auth';
import { User } from './types';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute, PublicRoute } from './router';
import { PortalProvider } from './staff/context/PortalContext';

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

// Admin pages (ticket management)
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

// Staff pages (CRM — admin/staff/sales)
import StaffDashboardPage from './staff/pages/DashboardPage';
import StaffClientsPage from './staff/pages/ClientsPage';
import StaffClientDetailPage from './staff/pages/ClientDetailPage';
import StaffCalendarPage from './staff/pages/CalendarPage';
import StaffMeetingsPage from './staff/pages/MeetingsPage';
import StaffFilesPage from './staff/pages/FilesPage';
import StaffNotesPage from './staff/pages/NotesPage';
import StaffSettingsPage from './staff/pages/SettingsPage';

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
      <PortalProvider>
        <ToastProvider>
          <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#f3f4f6' } }} />
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
              <Route element={<ProtectedRoute allowedRoles={['client']} />}>
                <Route path="/dashboard" element={<ClientDashboard />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/tickets/new" element={<NewTicketPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Admin routes — ticket management, admin only */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/tickets" element={<AdminTicketsPage />} />
                <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/users/:id" element={<AdminUserDetail />} />
                <Route path="/admin/accounts" element={<AdminAccountsPage />} />
                <Route path="/admin/profile" element={<AdminProfilePage />} />
              </Route>

              {/* Staff routes — CRM, open to admin/staff/sales */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'staff', 'sales']} />}>
                <Route path="/staff" element={<StaffDashboardPage />} />
                <Route path="/staff/clients" element={<StaffClientsPage />} />
                <Route path="/staff/clients/:id" element={<StaffClientDetailPage />} />
                <Route path="/staff/calendar" element={<StaffCalendarPage />} />
                <Route path="/staff/meetings" element={<StaffMeetingsPage />} />
                <Route path="/staff/files" element={<StaffFilesPage />} />
                <Route path="/staff/notes" element={<StaffNotesPage />} />
                <Route path="/staff/settings" element={<StaffSettingsPage />} />
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </PortalProvider>
    </AuthContext.Provider>
  );
}
