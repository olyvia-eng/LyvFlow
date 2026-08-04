import { ChevronDown } from 'lucide-react';
import type { SidebarSectionConfig } from '../../navigation/types';
import SidebarItem from './SidebarItem';

interface SidebarSectionProps {
  section: SidebarSectionConfig;
  compact?: boolean;
  collapsed?: boolean;
  onToggle?: (sectionId: string) => void;
  onNavigate?: () => void;
  onAction?: (actionId: string) => void;
}

export default function SidebarSection({
  section,
  compact = true,
  collapsed,
  onToggle,
  onNavigate,
  onAction,
}: SidebarSectionProps) {
  const isCollapsible = section.collapsible !== false;
  const isCollapsed = collapsed ?? !(section.defaultExpanded ?? true);

  return (
    <div className="mb-3">
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700"
        onClick={() => {
          if (!isCollapsible) return;
          onToggle?.(section.id);
        }}
      >
        <span>{section.title}</span>
        {isCollapsible ? (
          <ChevronDown size={13} className={`transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        ) : null}
      </button>

      {!isCollapsed && (
        <div className="mt-1 space-y-0.5 pl-1">
          {section.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
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
