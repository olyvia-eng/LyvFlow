import { Outlet } from 'react-router-dom';
import { Star } from 'lucide-react';
import Sidebar from './Sidebar';
import type { BusinessUserRole } from '../../auth/types';
import { FavoritesProvider, useFavorites } from '../../navigation/FavoritesContext';

interface AppLayoutProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

function FavoritePageButton() {
  const { currentPage, isCurrentPageFavorited, toggleCurrentPageFavorite } = useFavorites();

  return (
    <button
      type="button"
      onClick={toggleCurrentPageFavorite}
      title={isCurrentPageFavorited ? `Remove ${currentPage.label} from favorites` : `Add ${currentPage.label} to favorites`}
      aria-label={isCurrentPageFavorited ? `Remove ${currentPage.label} from favorites` : `Add ${currentPage.label} to favorites`}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        isCurrentPageFavorited
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Star size={15} className={isCurrentPageFavorited ? 'fill-current' : ''} />
      Favorite
    </button>
  );
}

export default function AppLayout({ userName, businessName, userRole, onLogout }: AppLayoutProps) {
  return (
    <FavoritesProvider userRole={userRole}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar userName={userName} businessName={businessName} userRole={userRole} onLogout={onLogout} />
        {/* Content area shifts right on desktop, down on mobile */}
        <main className="lg:ml-72 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <div className="flex justify-end mb-3">
              <FavoritePageButton />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </FavoritesProvider>
  );
}
