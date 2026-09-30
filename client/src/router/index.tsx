import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { PageSpinner } from '../components/Spinner';
import { Role } from '../types';

export function defaultRouteForRole(role: Role): string {
  if (role === 'client') return '/dashboard';
  if (role === 'admin') return '/admin';
  return '/staff'; // staff, sales
}

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
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
  if (user) return <Navigate to={defaultRouteForRole(user.role)} replace />;
  return <Outlet />;
}
