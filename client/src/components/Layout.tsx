import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { useToast } from './Toast';
import GlobalSearch from './GlobalSearch';
import { usePortal } from '../staff/context/PortalContext';
import { useTheme } from '../hooks/useTheme';

const DEFAULT_PORTAL_NAME = 'Apex Portal';
import {
  LayoutDashboard,
  Ticket,
  Users,
  LogOut,
  Menu,
  ChevronRight,
  UserCircle,
  ShieldCheck,
  Building2,
  Calendar,
  CalendarClock,
  FileStack,
  StickyNote,
  Settings,
  ListChecks,
  Sun,
  Moon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

function NavLinks({ groups, onClick }: { groups: NavGroup[]; onClick?: () => void }) {
  return (
    <div className="space-y-6">
      {groups.map((group, i) => (
        <div key={group.label || i}>
          {group.label && (
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              {group.label}
            </p>
          )}
          <nav className="space-y-0.5">
            {group.items
              .filter((item) => !item.hidden)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClick}
                  end={item.to.endsWith('dashboard') || item.to === '/admin' || item.to === '/staff'}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 [&>svg]:text-brand-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 [&>svg]:text-gray-400'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  // CRM pages and the combined admin dashboard use the full width
  const wideLayout = location.pathname.startsWith('/staff') || location.pathname === '/admin';

  const clientNav: NavGroup[] = [
    {
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { to: '/tickets', label: 'My Tickets', icon: <Ticket className="w-4 h-4" /> },
        { to: '/profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
      ],
    },
  ];

  const ticketNav: NavItem[] = [
    { to: '/admin/tickets', label: 'All Tickets', icon: <Ticket className="w-4 h-4" /> },
    { to: '/admin/users', label: 'Portal Logins', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/accounts', label: 'Admin Accounts', icon: <ShieldCheck className="w-4 h-4" /> },
    { to: '/admin/profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
  ];

  const staffNav: NavItem[] = [
    { to: '/staff/tasks', label: 'Tasks', icon: <ListChecks className="w-4 h-4" />, hidden: user?.role === 'sales' },
    { to: '/staff/clients', label: 'Clients', icon: <Building2 className="w-4 h-4" /> },
    { to: '/staff/calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" />, hidden: user?.role === 'sales' },
    { to: '/staff/meetings', label: 'Meetings', icon: <CalendarClock className="w-4 h-4" /> },
    { to: '/staff/files', label: 'Files', icon: <FileStack className="w-4 h-4" /> },
    { to: '/staff/notes', label: 'Notes', icon: <StickyNote className="w-4 h-4" /> },
    { to: '/staff/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  let navGroups: NavGroup[];
  if (user?.role === 'admin') {
    // One dashboard covering tickets and the CRM, then each area's pages
    navGroups = [
      { items: [{ to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }] },
      { label: 'Tickets', items: ticketNav },
      { label: 'Staff Portal', items: staffNav },
    ];
  } else if (user?.role === 'staff' || user?.role === 'sales') {
    navGroups = [{ items: [{ to: '/staff', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }, ...staffNav] }];
  } else {
    navGroups = clientNav;
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      /* proceed with client-side logout regardless */
    }
    setUser(null);
    navigate('/login');
    toast('Logged out successfully', 'success');
  }

  const homeLink =
    user?.role === 'admin' ? '/admin' : user?.role === 'staff' || user?.role === 'sales' ? '/staff' : '/dashboard';

  // Branding set in Staff Settings. Until a custom name is saved, keep the
  // original "Apex Studio" sidebar title clients already know.
  const { logoUrl, portalName } = usePortal();
  const { theme, toggle: toggleTheme } = useTheme();
  const sidebarTitle = portalName && portalName !== DEFAULT_PORTAL_NAME ? portalName : 'Apex Studio';

  const sidebar = (
    <aside className="flex flex-col h-full w-60 shrink-0 bg-sidebar border-r border-line">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <Link to={homeLink} className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-700">
            <img src={logoUrl || '/logo.png'} alt={sidebarTitle} className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight text-gray-900 truncate">{sidebarTitle}</p>
            <p className="text-xs text-gray-500">
              {user?.role === 'client' ? 'Client Portal' : 'Staff Portal'}
            </p>
          </div>
        </Link>
      </div>

      {/* Search — staff/admin/sales only, not the client ticket portal */}
      {user?.role !== 'client' && (
        <div className="px-3">
          <GlobalSearch />
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 px-3 py-5 overflow-y-auto">
        <NavLinks groups={navGroups} onClick={() => setMobileOpen(false)} />
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-line">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold bg-brand-700 text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium truncate text-gray-900">{user?.name}</p>
            <p className="text-xs capitalize text-gray-500">{user?.role}</p>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full w-60">{sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-line text-gray-900">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">{portalName || DEFAULT_PORTAL_NAME}</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-canvas">
          {wideLayout ? (
            <div className="p-6 lg:p-8">{children}</div>
          ) : (
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">{children}</div>
          )}
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
        <nav className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-3">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb.to}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              <Link to={crumb.to} className="hover:text-gray-900">{crumb.label}</Link>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
