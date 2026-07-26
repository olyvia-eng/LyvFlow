import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Wallet,
  UserCheck,
  CalendarDays,
  BarChart3,
  LogOut,
  Menu,
  X,
  Leaf,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crm', label: 'CRM', icon: Users },
  { to: '/estimates', label: 'Estimates', icon: FileText },
  { to: '/estimates/templates', label: 'Est. Templates', icon: FileText },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/employees', label: 'Employees', icon: UserCheck },
  { to: '/data-center', label: 'Data Center', icon: BarChart3 },
];

interface SidebarProps {
  userName: string;
  onLogout: () => void;
}

export default function Sidebar({ userName, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLink = (item: typeof NAV_ITEMS[0]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-gray-600 hover:bg-brand-50 hover:text-brand-700'
        }`
      }
    >
      <item.icon size={18} />
      {item.label}
    </NavLink>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 font-bold text-brand-700">
          <Leaf size={22} />
          LyvFlow
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-14 left-0 bottom-0 z-20 w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-1 transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1">{NAV_ITEMS.map(navLink)}</div>
        <div className="pt-3 border-t border-gray-200 mt-3">
          <p className="text-xs text-gray-500 mb-2 px-1">Signed in as {userName}</p>
          <button
            onClick={() => {
              setMobileOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white border-r border-gray-200 p-5 gap-1 fixed top-0 left-0 bottom-0">
        <div className="flex items-center gap-2 font-bold text-brand-700 text-lg mb-6 px-1">
          <Leaf size={24} />
          LyvFlow
        </div>
        <div className="flex-1">{NAV_ITEMS.map(navLink)}</div>
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2 px-1">Signed in as {userName}</p>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
