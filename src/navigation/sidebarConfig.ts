import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  FileBox,
  FileText,
  FolderOpen,
  HandCoins,
  HardHat,
  Package,
  Receipt,
  LayoutDashboard,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { BusinessUserRole } from '../auth/types';
import type { SidebarConfig, SidebarLinkItem, SidebarNavItem, SidebarSectionConfig } from './types';

const ownerAdminRoles: BusinessUserRole[] = ['owner', 'admin'];

const icon = (value: LucideIcon): LucideIcon => value;

const NAVIGATION_CONFIG: SidebarConfig = {
  topLevel: [
    { id: 'company-dashboard', type: 'link', to: '/', end: true, label: 'Company Dashboard', icon: icon(LayoutDashboard) },
  ],
  pinnedPages: [
    { id: 'pin-calendar', type: 'link', to: '/calendar', label: 'Calendar', icon: icon(CalendarDays) },
    { id: 'pin-clients', type: 'link', to: '/crm', label: 'Clients', icon: icon(Users) },
    { id: 'pin-jobs', type: 'link', to: '/jobs', label: "Today's Jobs", icon: icon(Briefcase) },
  ],
  sections: [
    {
      id: 'revenue',
      title: 'Revenue',
      collapsible: true,
      defaultExpanded: true,
      items: [
        { id: 'revenue-dashboard', type: 'link', to: '/revenue/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
        { id: 'revenue-clients', type: 'link', to: '/crm', label: 'Clients', icon: icon(Users) },
        { id: 'revenue-estimates', type: 'link', to: '/estimates', label: 'Estimates', icon: icon(FileText) },
      ],
    },
    {
      id: 'finance',
      title: 'Finance',
      collapsible: true,
      defaultExpanded: false,
      items: [
        { id: 'finance-dashboard', type: 'link', to: '/finance/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
        { id: 'finance-company-budget', type: 'link', to: '/budgets', label: 'Budgets', icon: icon(Wallet) },
        { id: 'finance-invoices', type: 'link', to: '/finance/invoices', label: 'Invoices', icon: icon(Receipt) },
        { id: 'finance-expenses', type: 'link', to: '/finance/expenses', label: 'Expenses', icon: icon(HandCoins) },
        { id: 'finance-profit-loss', type: 'link', to: '/finance/profit-loss', label: 'Profit & Loss', icon: icon(FileText) },
        {
          id: 'finance-reports',
          type: 'link',
          to: '/time-reports',
          label: 'Reports',
          icon: icon(Clock),
          roles: ownerAdminRoles,
        },
      ],
    },
    {
      id: 'operations',
      title: 'Operations',
      collapsible: true,
      defaultExpanded: false,
      items: [
        { id: 'operations-dashboard', type: 'link', to: '/operations/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
        { id: 'operations-jobs', type: 'link', to: '/jobs', label: 'Jobs', icon: icon(Briefcase) },
        { id: 'operations-calendar', type: 'link', to: '/calendar', label: 'Calendar', icon: icon(CalendarDays) },
        { id: 'operations-equipment', type: 'link', to: '/operations/equipment', label: 'Equipment', icon: icon(HardHat) },
        { id: 'operations-forms', type: 'link', to: '/data-center/forms', label: 'Forms', icon: icon(FileBox) },
        { id: 'operations-inventory', type: 'link', to: '/operations/inventory', label: 'Inventory', icon: icon(Package) },
      ],
    },
    {
      id: 'employees',
      title: 'Employees',
      collapsible: true,
      defaultExpanded: false,
      items: [
        { id: 'employees-dashboard', type: 'link', to: '/employees/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
        { id: 'employees-list', type: 'link', to: '/employees', label: 'Employees', icon: icon(UserCheck) },
        {
          id: 'employees-time-tracking',
          type: 'link',
          to: '/time-reports',
          label: 'Time Tracking',
          icon: icon(Clock),
          roles: ownerAdminRoles,
        },
      ],
    },
    {
      id: 'data-center',
      title: 'Data Center',
      collapsible: true,
      defaultExpanded: false,
      items: [
        { id: 'data-center-dashboard', type: 'link', to: '/data-center/dashboard', label: 'Dashboard', icon: icon(BarChart3) },
        { id: 'data-center-documents', type: 'link', to: '/data-center/documents', label: 'Documents', icon: icon(FolderOpen) },
      ],
    },
  ],
};

const includesRole = (roles: BusinessUserRole[] | undefined, userRole: BusinessUserRole) => {
  if (!roles || roles.length === 0) return true;
  return roles.includes(userRole);
};

const collectLinkItems = (items: SidebarNavItem[]): SidebarLinkItem[] => {
  return items.flatMap((item) => {
    if (item.type === 'link') return [item];
    if (item.type === 'group') return collectLinkItems(item.children);
    return [];
  });
};

const filterNavItem = (item: SidebarNavItem, userRole: BusinessUserRole): SidebarNavItem | null => {
  if (!includesRole(item.roles, userRole)) return null;

  if (item.type !== 'group') return item;

  const children = item.children
    .map((child) => filterNavItem(child, userRole))
    .filter((child): child is SidebarNavItem => child !== null);

  if (children.length === 0) return null;
  return { ...item, children };
};

const filterSection = (section: SidebarSectionConfig, userRole: BusinessUserRole): SidebarSectionConfig | null => {
  if (!includesRole(section.roles, userRole)) return null;

  const items = section.items
    .map((item) => filterNavItem(item, userRole))
    .filter((item): item is SidebarNavItem => item !== null);

  if (items.length === 0) return null;
  return { ...section, items };
};

export const getSidebarConfig = (userRole: BusinessUserRole): SidebarConfig => {
  const topLevel = NAVIGATION_CONFIG.topLevel
    .map((item) => filterNavItem(item, userRole))
    .filter((item): item is SidebarNavItem => item !== null);

  const pinnedPages = NAVIGATION_CONFIG.pinnedPages
    .map((item) => filterNavItem(item, userRole))
    .filter((item): item is SidebarNavItem => item !== null);

  const sections = NAVIGATION_CONFIG.sections
    .map((section) => filterSection(section, userRole))
    .filter((section): section is SidebarSectionConfig => section !== null);

  return {
    topLevel,
    pinnedPages,
    sections,
  };
};

export const getSidebarLinkItems = (userRole: BusinessUserRole): SidebarLinkItem[] => {
  const config = getSidebarConfig(userRole);
  const sectionItems = config.sections.flatMap((section) => collectLinkItems(section.items));
  const all = [...collectLinkItems(config.topLevel), ...sectionItems];

  const seen = new Set<string>();
  const unique: SidebarLinkItem[] = [];

  for (const item of all) {
    const key = `${item.to}::${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
};
