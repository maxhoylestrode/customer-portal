import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { PageSpinner } from '../components/Spinner';

export function ProtectedRoute({ requiredRole }: { requiredRole?: 'client' | 'admin' }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function PublicRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <Outlet />;
}
