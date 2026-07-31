import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { BusinessUserRole } from '../auth/types';
import { getSidebarLinkItems } from './sidebarConfig';

const FAVORITES_STORAGE_KEY = 'oliveops.navigation.favorites.v1';

const saveFavorites = (favorites: FavoritePage[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

type FavoritePage = {
  id: string;
  label: string;
  to: string;
  end?: boolean;
};

type FavoritesContextValue = {
  favorites: FavoritePage[];
  currentPage: FavoritePage;
  isCurrentPageFavorited: boolean;
  toggleCurrentPageFavorite: () => void;
  isPageFavorited: (to: string) => boolean;
  toggleFavoritePage: (page: FavoritePage) => void;
  reorderFavorites: (fromIndex: number, toIndex: number) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const normalizePath = (value: string) => {
  if (!value) return '/';
  if (value === '/') return '/';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const isRouteActive = (pathname: string, to: string, end?: boolean) => {
  const normalizedPath = normalizePath(pathname);
  const normalizedTo = normalizePath(to);

  if (normalizedTo === '/') return normalizedPath === '/';
  if (end) return normalizedPath === normalizedTo;
  return normalizedPath === normalizedTo || normalizedPath.startsWith(`${normalizedTo}/`);
};

const toFallbackLabel = (pathname: string) => {
  if (pathname === '/') return 'Company Dashboard';
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');
};

interface FavoritesProviderProps {
  userRole: BusinessUserRole;
  children: ReactNode;
}

export function FavoritesProvider({ userRole, children }: FavoritesProviderProps) {
  const location = useLocation();
  const candidates = useMemo(() => getSidebarLinkItems(userRole), [userRole]);

  const [favorites, setFavorites] = useState<FavoritePage[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) {
        setFavorites([]);
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setFavorites([]);
        setHydrated(true);
        return;
      }

      const loaded = parsed.filter((value): value is FavoritePage => {
        return (
          typeof value?.id === 'string' &&
          typeof value?.label === 'string' &&
          typeof value?.to === 'string'
        );
      });

      setFavorites(loaded);
    } catch {
      setFavorites([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    saveFavorites(favorites);
  }, [favorites, hydrated]);

  const currentPage = useMemo<FavoritePage>(() => {
    const pathname = normalizePath(location.pathname);

    const match = [...candidates]
      .sort((a, b) => b.to.length - a.to.length)
      .find((candidate) => isRouteActive(pathname, candidate.to, candidate.end));

    if (match) {
      return {
        id: match.id,
        label: match.label,
        to: normalizePath(match.to),
        end: match.end,
      };
    }

    return {
      id: `custom-${pathname}`,
      label: toFallbackLabel(pathname),
      to: pathname,
      end: true,
    };
  }, [candidates, location.pathname]);

  const isCurrentPageFavorited = useMemo(() => {
    return favorites.some((favorite) => normalizePath(favorite.to) === normalizePath(currentPage.to));
  }, [currentPage.to, favorites]);

  const toggleCurrentPageFavorite = () => {
    setFavorites((current) => {
      const currentPath = normalizePath(currentPage.to);
      const exists = current.some((favorite) => normalizePath(favorite.to) === currentPath);

      if (exists) {
        const next = current.filter((favorite) => normalizePath(favorite.to) !== currentPath);
        saveFavorites(next);
        return next;
      }

      const next = [...current, currentPage];
      saveFavorites(next);
      return next;
    });
  };

  const isPageFavorited = (to: string) => {
    const path = normalizePath(to);
    return favorites.some((favorite) => normalizePath(favorite.to) === path);
  };

  const toggleFavoritePage = (page: FavoritePage) => {
    setFavorites((current) => {
      const targetPath = normalizePath(page.to);
      const exists = current.some((favorite) => normalizePath(favorite.to) === targetPath);

      if (exists) {
        const next = current.filter((favorite) => normalizePath(favorite.to) !== targetPath);
        saveFavorites(next);
        return next;
      }

      const next = [
        ...current,
        {
          ...page,
          to: targetPath,
        },
      ];
      saveFavorites(next);
      return next;
    });
  };

  const reorderFavorites = (fromIndex: number, toIndex: number) => {
    setFavorites((current) => {
      if (fromIndex === toIndex) return current;
      if (fromIndex < 0 || fromIndex >= current.length) return current;
      if (toIndex < 0 || toIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      saveFavorites(next);
      return next;
    });
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        currentPage,
        isCurrentPageFavorited,
        toggleCurrentPageFavorite,
        isPageFavorited,
        toggleFavoritePage,
        reorderFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}
