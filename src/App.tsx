import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import CRMPage from './pages/crm/CRMPage';
import EstimatesPage from './pages/estimates/EstimatesPage';
import TemplatesPage from './pages/estimates/TemplatesPage';
import JobsPage from './pages/jobs/JobsPage';
import JobDetailPage from './pages/jobs/JobDetailPage';
import BudgetPage from './pages/budget/BudgetPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import DataCenterPage from './pages/datacenter/DataCenterPage';
import EmployeePortalPage from './pages/employees/EmployeePortalPage';
import CalendarPage from './pages/calendar/CalendarPage';
import LoginPage from './pages/auth/LoginPage';

interface AuthUser {
  name: string;
}

const AUTH_STORAGE_KEY = 'lyvflow.auth.user';
const DEV_ADMIN_USERNAME = import.meta.env.VITE_DEV_ADMIN_USERNAME ?? 'admin';
const DEV_ADMIN_PASSWORD = import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? 'lyvflow123';

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string') {
      return { name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const useAuthenticatedUser = (name: string) => {
    const nextUser: AuthUser = { name };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const tryDevFallbackLogin = (username: string, password: string): boolean => {
    if (!import.meta.env.DEV) return false;

    const isValid =
      username.trim().toLowerCase() === DEV_ADMIN_USERNAME.trim().toLowerCase() &&
      password === DEV_ADMIN_PASSWORD;

    if (!isValid) return false;
    useAuthenticatedUser('Admin User (Local)');
    return true;
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status >= 500) {
          return tryDevFallbackLogin(username, password);
        }
        return false;
      }

      const payload = await response.json();
      if (!payload?.ok || typeof payload?.user?.name !== 'string') {
        return false;
      }

      useAuthenticatedUser(payload.user.name);
      return true;
    } catch {
      return tryDevFallbackLogin(username, password);
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="employee-login" element={<EmployeePortalPage />} />

        {user ? (
          <>
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route element={<AppLayout userName={user.name} onLogout={logout} />}>
              <Route index element={<Dashboard />} />
              <Route path="crm" element={<CRMPage />} />
              <Route path="estimates" element={<EstimatesPage />} />
              <Route path="estimates/templates" element={<TemplatesPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="jobs/:id" element={<JobDetailPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="data-center" element={<DataCenterPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="login" element={<LoginPage onLogin={login} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
