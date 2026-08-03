import { ChevronDown, Pin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePinnedPages } from '../../navigation/PinnedPagesContext';
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
  const { isPagePinned, togglePinnedPage } = usePinnedPages();
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
    const pinned = isPagePinned(item.to);

    return (
      <div style={indentStyle} className="group relative flex items-center gap-1">
        <NavLink
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `group relative flex min-w-0 flex-1 items-center gap-2 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} pl-3 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-800'
                : 'text-brand-700 hover:bg-brand-50 hover:text-brand-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r ${
                  isActive ? 'bg-accent-500' : 'bg-transparent group-hover:bg-brand-200'
                }`}
              />
              {Icon ? <Icon size={compact ? 14 : 15} /> : null}
              <span className="truncate text-left">{item.label}</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
          title={pinned ? 'Unpin page' : 'Pin page'}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            pinned
              ? 'text-accent-700 hover:bg-accent-50'
              : 'text-brand-300 hover:text-accent-700 hover:bg-brand-50'
          }`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePinnedPage({
              id: item.id,
              label: item.label,
              to: item.to,
              end: item.end,
            });
          }}
        >
          <Pin size={14} className={pinned ? 'fill-current' : ''} />
        </button>
      </div>
    );
  }

  const GroupIcon = item.icon;
  const isCollapsible = item.collapsible !== false;

  return (
    <div style={indentStyle} className="relative">
      <button
        type="button"
        className={`w-full flex items-center justify-between ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
          isBranchActive
            ? 'text-brand-800 bg-brand-50'
            : 'text-brand-700 hover:bg-brand-50 hover:text-brand-900'
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
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : 'rotate-0'}`} />
        ) : null}
      </button>

      {expanded && (
        <div className="mt-1 ml-2 pl-2 border-l border-brand-100 space-y-0.5" role="menu" aria-label={`${item.label} submenu`}>
          {item.children.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              level={level + 1}
              compact={compact}
              onNavigate={onNavigate}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
