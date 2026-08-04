import { Outlet } from 'react-router-dom';
import { Pin } from 'lucide-react';
import Sidebar from './Sidebar';
import type { BusinessUserRole } from '../../auth/types';
import { PinnedPagesProvider, usePinnedPages } from '../../navigation/PinnedPagesContext';
import { Button } from '../ui';

interface AppLayoutProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

function PinPageButton() {
  const { currentPage, isCurrentPagePinned, toggleCurrentPagePinned } = usePinnedPages();

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggleCurrentPagePinned}
      title={isCurrentPagePinned ? `Unpin ${currentPage.label}` : `Pin ${currentPage.label}`}
      aria-label={isCurrentPagePinned ? `Unpin ${currentPage.label}` : `Pin ${currentPage.label}`}
      className={isCurrentPagePinned ? 'bg-accent-50 dark:bg-brand-600 border-accent-100 dark:border-brand-500 text-accent-600 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-brand-500' : ''}
    >
      <Pin size={15} className={isCurrentPagePinned ? 'fill-current' : ''} />
      Pin
    </Button>
  );
}

export default function AppLayout({ userName, businessName, userRole, onLogout }: AppLayoutProps) {
  return (
    <PinnedPagesProvider userRole={userRole}>
      <div className="min-h-screen bg-cream dark:bg-brand-900">
        <Sidebar userName={userName} businessName={businessName} userRole={userRole} onLogout={onLogout} />
        {/* Content area shifts right on desktop, down on mobile */}
        <main className="lg:ml-72 pt-14 lg:pt-0 min-h-screen">
          <div className="border-b border-brand-100 dark:border-brand-600 bg-white dark:bg-brand-800">
            <div className="p-3 sm:px-6 sm:py-3 max-w-7xl mx-auto">
              <div className="flex justify-end">
                <PinPageButton />
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </PinnedPagesProvider>
  );
}
