import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NotFoundPage() {
  const { user } = useAuth();
  const home = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/login';

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="text-center">
        <p className="num text-6xl font-semibold text-gray-900 mb-4">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
        <Link to={home} className="btn-primary inline-block">Go Home</Link>
      </div>
    </div>
  );
}
