import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { useToast } from './Toast';
import {
  LayoutDashboard,
  Ticket,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserCircle,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

function NavLinks({ items, onClick }: { items: NavItem[]; onClick?: () => void }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClick}
          end={item.to.endsWith('dashboard') || item.to === '/admin'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/20 text-white'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const clientNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/tickets', label: 'My Tickets', icon: <Ticket className="w-4 h-4" /> },
    { to: '/profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
  ];

  const adminNav: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/admin/tickets', label: 'All Tickets', icon: <Ticket className="w-4 h-4" /> },
    { to: '/admin/users', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/accounts', label: 'Admin Accounts', icon: <ShieldCheck className="w-4 h-4" /> },
    { to: '/admin/profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
  ];

  const navItems = user?.role === 'admin' ? adminNav : clientNav;

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {}
    setUser(null);
    navigate('/login');
    toast('Logged out successfully', 'success');
  }

  const sidebar = (
    <aside className="flex flex-col h-full bg-[#0D3040] text-white w-64 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3">
          <img src="/logo.png" alt="Apex Studio Codes" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="font-bold text-sm leading-tight">Apex Studio</p>
            <p className="text-blue-200 text-xs">Client Portal</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4">
        <NavLinks items={navItems} onClick={() => setMobileOpen(false)} />
      </div>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-blue-200 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full w-64">{sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0D3040] text-white">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Apex Portal</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; to: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb.to}>
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <Link to={crumb.to} className="hover:text-[#0D3040]">{crumb.label}</Link>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0D3040]">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
