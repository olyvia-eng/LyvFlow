import {
  LogOut,
  Menu,
  X,
  Leaf,
  Star,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { BusinessUserRole } from '../../auth/types';
import { getSidebarConfig, getSidebarLinkItems } from '../../navigation/sidebarConfig';
import type { SidebarNavItem } from '../../navigation/types';
import SidebarItem from './SidebarItem';
import SidebarSection from './SidebarSection';
import { useFavorites } from '../../navigation/FavoritesContext';

const EXPANDED_SECTIONS_STORAGE_KEY = 'oliveops.sidebar.expanded-sections.v1';

interface SidebarProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

export default function Sidebar({ userName, businessName, userRole, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const navigation = getSidebarConfig(userRole);
  const linkCandidates = getSidebarLinkItems(userRole);
  const { favorites, reorderFavorites } = useFavorites();

  const allSectionIds = useMemo(() => {
    return ['favorites', ...navigation.sections.map((section) => section.id)];
  }, [navigation.sections]);

  const defaultExpandedSectionId = useMemo(() => {
    const preferred = navigation.sections.find((section) => section.defaultExpanded)?.id;
    return preferred ?? navigation.sections[0]?.id ?? '';
  }, [navigation.sections]);

  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(EXPANDED_SECTIONS_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is string => typeof value === 'string');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setExpandedSectionIds((current) => {
      const filtered = current.filter((id) => allSectionIds.includes(id));
      if (filtered.length > 0) return filtered;
      return defaultExpandedSectionId ? [defaultExpandedSectionId] : [];
    });
  }, [allSectionIds, defaultExpandedSectionId]);

  useEffect(() => {
    window.localStorage.setItem(EXPANDED_SECTIONS_STORAGE_KEY, JSON.stringify(expandedSectionIds));
  }, [expandedSectionIds]);

  const handleAction = (actionId: string) => {
    void actionId;
  };

  const isExpanded = (sectionId: string) => expandedSectionIds.includes(sectionId);
  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((current) => {
      if (current.includes(sectionId)) {
        return current.filter((id) => id !== sectionId);
      }
      return [...current, sectionId];
    });
  };

  const closeSection = (sectionId: string) => {
    setExpandedSectionIds((current) => current.filter((id) => id !== sectionId));
  };

  const favoriteItems: SidebarNavItem[] = useMemo(() => {
    return favorites.map((favorite) => ({
      ...(linkCandidates.find((candidate) => candidate.to === favorite.to && candidate.label === favorite.label) ?? {}),
      id: `fav-${favorite.id}`,
      type: 'link' as const,
      to: favorite.to,
      end: favorite.end,
      label: favorite.label,
    }));
  }, [favorites, linkCandidates]);

  const renderFavoriteItem = (item: SidebarNavItem, index: number) => (
    <div
      key={`fav-${item.id}`}
      className="flex items-center"
      draggable
      onDragStart={() => setDragIndex(index)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={() => {
        if (dragIndex === null) return;
        reorderFavorites(dragIndex, index);
        setDragIndex(null);
      }}
      onDragEnd={() => setDragIndex(null)}
    >
      <Star size={12} className="mr-2 text-amber-400" />
      <SidebarItem
        item={item}
        compact
        onNavigate={() => setMobileOpen(false)}
        onAction={handleAction}
      />
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
          <div className="mb-3 space-y-0.5">
            {navigation.topLevel.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                compact
                onNavigate={() => setMobileOpen(false)}
                onAction={handleAction}
              />
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 p-3 mb-4">
            <button
              type="button"
              className="w-full text-left px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1"
              onClick={() => toggleSection('favorites')}
            >
              Favorites
            </button>
            {isExpanded('favorites') && (
              <div className="space-y-0.5">
                {favoriteItems.map((item, index) => renderFavoriteItem(item, index))}
              </div>
            )}
          </div>

          {navigation.sections.map((section) => (
            <SidebarSection
              key={section.id}
              section={section}
              compact
              collapsed={!isExpanded(section.id)}
              onToggle={toggleSection}
              onClose={closeSection}
              onNavigate={() => setMobileOpen(false)}
              onAction={handleAction}
            />
          ))}
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
          <div className="mb-3 space-y-0.5">
            {navigation.topLevel.map((item) => (
              <SidebarItem
                key={`desktop-${item.id}`}
                item={item}
                compact
                onNavigate={() => setMobileOpen(false)}
                onAction={handleAction}
              />
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 p-3 mb-4">
            <button
              type="button"
              className="w-full text-left px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1"
              onClick={() => toggleSection('favorites')}
            >
              Favorites
            </button>
            {isExpanded('favorites') && (
              <div className="space-y-0.5">
                {favoriteItems.map((item, index) => renderFavoriteItem(item, index))}
              </div>
            )}
          </div>

          {navigation.sections.map((section) => (
            <SidebarSection
              key={section.id}
              section={section}
              compact
              collapsed={!isExpanded(section.id)}
              onToggle={toggleSection}
              onClose={closeSection}
              onNavigate={() => setMobileOpen(false)}
              onAction={handleAction}
            />
          ))}
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
