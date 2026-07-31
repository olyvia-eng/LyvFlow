import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Briefcase,
  Wallet,
  UserCheck,
  CalendarDays,
  BarChart3,
  Clock,
  LogOut,
  Menu,
  X,
  Leaf,
  Star,
  Settings,
  ClipboardList,
  Calculator,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BusinessUserRole } from '../../auth/types';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const FAVORITES: NavItem[] = [
  { to: '/budget', label: 'Labour Planner', icon: Wallet },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/crm', label: 'Clients', icon: Users },
  { to: '/estimates/templates', label: 'Estimate Templates', icon: FileText },
  { to: '/jobs', label: "Today's Jobs", icon: Briefcase },
];

const buildSections = (role: BusinessUserRole): NavSection[] => {
  const canManage = role === 'owner' || role === 'admin';

  return [
    {
      title: 'Revenue',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/crm', label: 'Leads & Clients', icon: Users },
        { to: '/estimates', label: 'Estimates', icon: FileText },
        { to: '/estimates/templates', label: 'Estimate Templates', icon: ClipboardList },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/budget', label: 'Labour Planner', icon: Calculator },
        ...(canManage ? [{ to: '/time-reports', label: 'Profit & Payroll Reports', icon: Clock }] : []),
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/jobs', label: 'Jobs', icon: Briefcase },
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/employees', label: 'Employees', icon: UserCheck },
        ...(canManage ? [{ to: '/time-reports', label: 'Time Reports', icon: Clock }] : []),
      ],
    },
    {
      title: 'Data Center',
      items: [
        { to: '/data-center', label: 'Dashboard', icon: BarChart3 },
        ...(canManage ? [{ to: '/user-access', label: 'User Access', icon: Shield }] : []),
      ],
    },
  ];
};

interface SidebarProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

export default function Sidebar({ userName, businessName, userRole, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = buildSections(userRole);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedSections((current) => {
      const next = { ...current };
      for (const section of sections) {
        if (typeof next[section.title] === 'undefined') {
          next[section.title] = false;
        }
      }
      return next;
    });
  }, [sections]);

  const navLink = (item: NavItem, compact = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `group relative flex items-center gap-2 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} pl-3 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r ${
              isActive ? 'bg-emerald-500' : 'bg-transparent group-hover:bg-gray-200'
            }`}
          />
          <item.icon size={compact ? 14 : 15} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );

  const sectionBlock = (section: NavSection) => (
    <div key={section.title} className="mb-3">
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-600"
        onClick={() =>
          setCollapsedSections((current) => ({
            ...current,
            [section.title]: !current[section.title],
          }))
        }
      >
        <span>{section.title}</span>
        <ChevronDown
          size={13}
          className={`transition-transform ${collapsedSections[section.title] ? '-rotate-90' : 'rotate-0'}`}
        />
      </button>
      {!collapsedSections[section.title] && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map((item) => navLink(item, true))}
        </div>
      )}
    </div>
  );

  const userInitials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 font-semibold text-brand-700">
          <Leaf size={22} />
          OliveOps
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
        className={`lg:hidden fixed top-14 left-0 bottom-0 z-20 w-72 bg-white border-r border-gray-200 p-4 flex flex-col transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="rounded-xl border border-gray-200 p-3 mb-4">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Favorites</p>
            <div className="space-y-0.5">
              {FAVORITES.map((item) => (
                <div key={`fav-${item.to}-${item.label}`} className="flex items-center">
                  <Star size={12} className="mr-2 text-amber-400" />
                  {navLink(item, true)}
                </div>
              ))}
            </div>
          </div>

          {sections.map(sectionBlock)}
        </div>
        <div className="pt-3 border-t border-gray-200 mt-3">
          <div className="flex items-center gap-3 px-1 mb-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">{userInitials}</div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{businessName}</p>
              <p className="text-[11px] text-gray-500">{userName}</p>
            </div>
          </div>
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
      <aside className="hidden lg:flex flex-col w-72 min-h-screen bg-white border-r border-gray-200 p-4 fixed top-0 left-0 bottom-0">
        <div className="flex items-center gap-2 font-semibold text-brand-700 text-[28px] mb-4 px-1">
          <Leaf size={24} />
          <span className="text-2xl">OliveOps</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="rounded-xl border border-gray-200 p-3 mb-4">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Favorites</p>
            <div className="space-y-0.5">
              {FAVORITES.map((item) => (
                <div key={`fav-desktop-${item.to}-${item.label}`} className="flex items-center">
                  <Star size={12} className="mr-2 text-amber-400" />
                  {navLink(item, true)}
                </div>
              ))}
            </div>
          </div>

          {sections.map(sectionBlock)}

          <div className="mt-2 px-2">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings size={14} /> Settings
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-1 mb-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">{userInitials}</div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{businessName}</p>
              <p className="text-[11px] text-gray-500">{userName}</p>
            </div>
          </div>
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
