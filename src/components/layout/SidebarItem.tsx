import { ChevronDown, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useFavorites } from '../../navigation/FavoritesContext';
import type { SidebarNavItem } from '../../navigation/types';

interface SidebarItemProps {
  item: SidebarNavItem;
  level?: number;
  compact?: boolean;
  onNavigate?: () => void;
  onAction?: (actionId: string) => void;
}

const isRouteActive = (pathname: string, to: string, end?: boolean) => {
  if (to === '/') return pathname === '/';
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
};

const hasActiveDescendant = (item: SidebarNavItem, pathname: string): boolean => {
  if (item.type === 'link') return isRouteActive(pathname, item.to, item.end);
  if (item.type === 'action') return false;
  return item.children.some((child) => hasActiveDescendant(child, pathname));
};

export default function SidebarItem({
  item,
  level = 0,
  compact = false,
  onNavigate,
  onAction,
}: SidebarItemProps) {
  const { pathname } = useLocation();
  const { isPageFavorited, toggleFavoritePage } = useFavorites();
  const isBranchActive = useMemo(() => hasActiveDescendant(item, pathname), [item, pathname]);

  const [expanded, setExpanded] = useState(item.type === 'group' ? (item.defaultExpanded ?? true) : false);

  useEffect(() => {
    if (item.type !== 'group') return;
    if (isBranchActive) setExpanded(true);
  }, [isBranchActive, item.type]);

  const indentStyle = level > 0 ? { marginLeft: `${Math.min(level * 10, 40)}px` } : undefined;

  if (item.type === 'action') {
    const Icon = item.icon;
    return (
      <button
        type="button"
        onClick={() => onAction?.(item.actionId)}
        style={indentStyle}
        className={`w-full flex items-center gap-2 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
      >
        {Icon ? <Icon size={compact ? 14 : 15} /> : null}
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  if (item.type === 'link') {
    const Icon = item.icon;
    const favorited = isPageFavorited(item.to);

    return (
      <div style={indentStyle} className="group relative flex items-center gap-1">
        <NavLink
          to={item.to}
          end={item.end}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            `group relative flex min-w-0 flex-1 items-center gap-2 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} pl-3 rounded-lg text-sm font-medium transition-colors ${
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
              {Icon ? <Icon size={compact ? 14 : 15} /> : null}
              <span className="truncate text-left">{item.label}</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          aria-label={favorited ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            favorited
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-gray-300 hover:text-amber-500 hover:bg-gray-100'
          }`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleFavoritePage({
              id: item.id,
              label: item.label,
              to: item.to,
              end: item.end,
            });
          }}
        >
          <Star size={14} className={favorited ? 'fill-current' : ''} />
        </button>
      </div>
    );
  }

  const GroupIcon = item.icon;
  const isCollapsible = item.collapsible !== false;
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!expanded) return;

    const updateFlyoutPosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
      const left = rect.right + 8;
      setFlyoutPosition({ top, left });
    };

    updateFlyoutPosition();

    const handleOutsidePointer = (event: MouseEvent) => {
      if (!flyoutRef.current) return;
      if (!flyoutRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    window.addEventListener('resize', updateFlyoutPosition);
    window.addEventListener('scroll', updateFlyoutPosition, true);
    window.addEventListener('click', handleOutsidePointer);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updateFlyoutPosition);
      window.removeEventListener('scroll', updateFlyoutPosition, true);
      window.removeEventListener('click', handleOutsidePointer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [expanded]);

  return (
    <div
      style={indentStyle}
      className="relative"
      ref={flyoutRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`w-full flex items-center justify-between ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
          isBranchActive
            ? 'text-emerald-700 bg-emerald-50'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={() => {
          if (!isCollapsible) return;
          setExpanded((current) => !current);
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          {GroupIcon ? <GroupIcon size={compact ? 14 : 15} /> : null}
          <span className="truncate">{item.label}</span>
        </span>
        {isCollapsible ? (
          <ChevronDown size={13} className={`transition-transform ${expanded ? '-rotate-90' : 'rotate-0'}`} />
        ) : null}
      </button>

      {expanded && (
        <div
          className="fixed min-w-[220px] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-50"
          style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
          role="menu"
          aria-label={`${item.label} submenu`}
        >
          <div className="space-y-0.5">
            {item.children.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                level={0}
                compact={compact}
                onNavigate={onNavigate}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
