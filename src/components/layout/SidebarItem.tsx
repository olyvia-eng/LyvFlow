import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

    return (
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        style={indentStyle}
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
            {Icon ? <Icon size={compact ? 14 : 15} /> : null}
            <span className="truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    );
  }

  const GroupIcon = item.icon;
  const isCollapsible = item.collapsible !== false;

  return (
    <div style={indentStyle}>
      <button
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
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        ) : null}
      </button>

      {expanded && (
        <div className="space-y-0.5 mt-0.5">
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
