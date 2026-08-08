import { Bell, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import type { NotificationFeedResponse, NotificationItem } from '../../notifications/types';

function formatRelativeTimestamp(isoValue: string) {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Today, just now';
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `Today, ${minutes} min ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `Today, ${hours} hr ago`;
  }

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);

  return dateLabel;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const pendingCorrectionCount = useStore((state) => (
    state.timeCorrections.reduce((total, item) => total + (item.status === 'pending' ? 1 : 0), 0)
  ));

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [actionableCount, setActionableCount] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const badgeLabel = actionableCount > 9 ? '9+' : String(actionableCount);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/time-corrections?action=notifications', {
        method: 'GET',
        credentials: 'include',
      });

      const body = await response.json().catch(() => null) as NotificationFeedResponse | null;
      if (!response.ok || !body?.ok) {
        setItems([]);
        setActionableCount(0);
        return;
      }

      const nextItems = Array.isArray(body.items) ? body.items : [];
      const nextCount = typeof body.count === 'number' ? body.count : nextItems.length;

      setItems(nextItems);
      setActionableCount(Math.max(0, nextCount));
    } catch {
      setItems([]);
      setActionableCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshNotifications();
  }, [isOpen, refreshNotifications]);

  useEffect(() => {
    void refreshNotifications();
  }, [pendingCorrectionCount, refreshNotifications]);

  useEffect(() => {
    const onFocus = () => {
      void refreshNotifications();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  const accessibleLabel = useMemo(() => {
    if (actionableCount <= 0) return 'Notifications, no items requiring attention';
    return `Notifications, ${actionableCount} items requiring attention`;
  }, [actionableCount]);

  const handleItemClick = (item: NotificationItem) => {
    setIsOpen(false);
    navigate(item.href);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={accessibleLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-white text-brand-700 shadow-sm transition-colors hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-brand-600 dark:bg-brand-700 dark:text-brand-100 dark:hover:bg-brand-600"
      >
        <Bell size={16} />
        {actionableCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-700 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="absolute right-0 z-30 mt-2 w-[min(90vw,22rem)] overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-xl dark:border-brand-600 dark:bg-brand-700"
        >
          <div className="border-b border-brand-100 px-4 py-3 dark:border-brand-600">
            <h2 className="text-sm font-semibold text-brand-900 dark:text-brand-50">Notifications</h2>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-4 text-sm text-brand-400 dark:text-brand-200">Loading notifications...</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-5">
                <p className="text-sm text-brand-700 dark:text-brand-100">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-100 dark:divide-brand-600" role="menu" aria-label="Notifications list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleItemClick(item)}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:hover:bg-brand-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-brand-900 dark:text-brand-50">{item.title}</p>
                          <p className="mt-1 text-xs text-brand-700 dark:text-brand-200">{item.employeeName} submitted a correction request.</p>
                          <p className="mt-1 text-xs text-brand-500 dark:text-brand-200">{item.summary}</p>
                          <p className="mt-1 text-[11px] text-brand-400 dark:text-brand-300">{formatRelativeTimestamp(item.submittedAt)}</p>
                        </div>
                        {item.actionable ? (
                          <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-accent-600" aria-hidden="true" />
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-brand-100 p-2 dark:border-brand-600">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/reports/time?correctionStatus=pending');
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:text-brand-100 dark:hover:bg-brand-600"
            >
              View all time corrections
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
