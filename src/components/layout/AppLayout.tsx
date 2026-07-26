import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  userName: string;
  onLogout: () => void;
}

export default function AppLayout({ userName, onLogout }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={userName} onLogout={onLogout} />
      {/* Content area shifts right on desktop, down on mobile */}
      <main className="lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
