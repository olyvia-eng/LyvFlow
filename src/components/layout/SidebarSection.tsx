import { ChevronDown } from 'lucide-react';
import { useEffect } from 'react';
import type { SidebarSectionConfig } from '../../navigation/types';
import SidebarItem from './SidebarItem';

interface SidebarSectionProps {
  section: SidebarSectionConfig;
  compact?: boolean;
  collapsed?: boolean;
  onToggle?: (sectionId: string) => void;
  onClose?: (sectionId: string) => void;
  onNavigate?: () => void;
  onAction?: (actionId: string) => void;
}

export default function SidebarSection({
  section,
  compact = true,
  collapsed,
  onToggle,
  onClose,
  onNavigate,
  onAction,
}: SidebarSectionProps) {
  const isCollapsible = section.collapsible !== false;
  const isCollapsed = collapsed ?? !(section.defaultExpanded ?? true);

  useEffect(() => {
    if (isCollapsed) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.(section.id);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isCollapsed, onClose, section.id]);

  return (
    <div
      className="mb-3 relative"
      onMouseLeave={() => {
        if (!isCollapsed) onClose?.(section.id);
      }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-600"
        onClick={() => {
          if (!isCollapsible) return;
          onToggle?.(section.id);
        }}
      >
        <span>{section.title}</span>
        {isCollapsible ? (
          <ChevronDown size={13} className={`transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
        ) : null}
      </button>

      {!isCollapsed && (
        <div className="absolute left-full top-0 ml-2 min-w-[240px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-40">
          <div className="space-y-0.5">
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
        </div>
      )}
    </div>
  );
}
