import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isCollapsed) return;

    const updateFlyoutPosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
      const left = rect.right + 8;
      setFlyoutPosition({ top, left });
    };

    updateFlyoutPosition();
    window.addEventListener('resize', updateFlyoutPosition);
    window.addEventListener('scroll', updateFlyoutPosition, true);
    return () => {
      window.removeEventListener('resize', updateFlyoutPosition);
      window.removeEventListener('scroll', updateFlyoutPosition, true);
    };
  }, [isCollapsed]);

  useEffect(() => {
    if (isCollapsed) return;

    const handleOutsidePointer = (event: MouseEvent) => {
      if (!sectionRef.current) return;
      if (!sectionRef.current.contains(event.target as Node)) {
        onClose?.(section.id);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.(section.id);
      }
    };

    window.addEventListener('click', handleOutsidePointer);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleOutsidePointer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCollapsed, onClose, section.id]);

  return (
    <div className="mb-3 relative" ref={sectionRef}>
      <button
        ref={triggerRef}
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
        <div
          className="fixed min-w-[240px] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-50"
          style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
        >
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
