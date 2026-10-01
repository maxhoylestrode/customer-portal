import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { useToast } from './Toast';
import GlobalSearch from './GlobalSearch';
import { usePortal } from '../staff/context/PortalContext';

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
    <div className="space-y-5">
      {groups.map((group, i) => (
        <div key={group.label || i}>
          {group.label && (
            <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
              {group.label}
            </p>
          )}
          <nav className="space-y-1">
            {group.items
              .filter((item) => !item.hidden)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClick}
                  end={item.to.endsWith('dashboard') || item.to === '/admin' || item.to === '/staff'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
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
    { to: '/admin/users', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/accounts', label: 'Admin Accounts', icon: <ShieldCheck className="w-4 h-4" /> },
    { to: '/admin/profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
  ];

  const staffNav: NavItem[] = [
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
  const sidebarTitle = portalName && portalName !== DEFAULT_PORTAL_NAME ? portalName : 'Apex Studio';

  const sidebar = (
    <aside className="flex flex-col h-full w-64 shrink-0 bg-[#0D3040] text-white">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <Link to={homeLink} className="flex items-center gap-3">
          <img src={logoUrl || '/logo.png'} alt={sidebarTitle} className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="font-bold text-sm leading-tight">{sidebarTitle}</p>
            <p className="text-xs text-blue-200">
              {user?.role === 'client' ? 'Client Portal' : 'Staff Portal'}
            </p>
          </div>
        </Link>
      </div>

      {/* Search — staff/admin/sales only, not the client ticket portal */}
      {user?.role !== 'client' && (
        <div className="px-3 pt-3">
          <GlobalSearch />
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <NavLinks groups={navGroups} onClick={() => setMobileOpen(false)} />
      </div>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-white/20">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-white">{user?.name}</p>
            <p className="text-xs capitalize text-blue-200">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-blue-100 hover:bg-white/10 hover:text-white"
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
          <span className="font-semibold text-sm">{portalName || DEFAULT_PORTAL_NAME}</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50">
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
