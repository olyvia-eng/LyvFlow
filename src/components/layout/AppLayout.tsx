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
      className={isCurrentPagePinned ? 'bg-accent-50 border-accent-200 text-accent-700 hover:bg-accent-100' : ''}
    >
      <Pin size={15} className={isCurrentPagePinned ? 'fill-current' : ''} />
      Pin
    </Button>
  );
}

export default function AppLayout({ userName, businessName, userRole, onLogout }: AppLayoutProps) {
  return (
    <PinnedPagesProvider userRole={userRole}>
      <div className="min-h-screen bg-cream">
        <Sidebar userName={userName} businessName={businessName} userRole={userRole} onLogout={onLogout} />
        {/* Content area shifts right on desktop, down on mobile */}
        <main className="lg:ml-72 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <div className="flex justify-end mb-3">
              <PinPageButton />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </PinnedPagesProvider>
  );
}
