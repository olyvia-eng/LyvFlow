import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import type { BusinessUserRole } from '../../auth/types';

interface AppLayoutProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

export default function AppLayout({ userName, businessName, userRole, onLogout }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={userName} businessName={businessName} userRole={userRole} onLogout={onLogout} />
      {/* Content area shifts right on desktop, down on mobile */}
      <main className="lg:ml-72 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
