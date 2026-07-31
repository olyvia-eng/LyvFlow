import { Outlet, useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import Sidebar from './Sidebar';
import type { BusinessUserRole } from '../../auth/types';
import { FavoritesProvider, useFavorites } from '../../navigation/FavoritesContext';
import { Button } from '../ui';

interface AppLayoutProps {
  userName: string;
  businessName: string;
  userRole: BusinessUserRole;
  onLogout: () => void | Promise<void>;
}

function FavoritePageButton() {
  const { currentPage, isCurrentPageFavorited, toggleCurrentPageFavorite } = useFavorites();

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggleCurrentPageFavorite}
      title={isCurrentPageFavorited ? `Remove ${currentPage.label} from favorites` : `Add ${currentPage.label} to favorites`}
      aria-label={isCurrentPageFavorited ? `Remove ${currentPage.label} from favorites` : `Add ${currentPage.label} to favorites`}
      className={isCurrentPageFavorited ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : ''}
    >
      <Star size={15} className={isCurrentPageFavorited ? 'fill-current' : ''} />
      Favorite
    </Button>
  );
}

export default function AppLayout({ userName, businessName, userRole, onLogout }: AppLayoutProps) {
  const { pathname } = useLocation();

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
            <div key={pathname}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </FavoritesProvider>
  );
}
