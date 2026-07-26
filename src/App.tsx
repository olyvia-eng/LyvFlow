import { useEffect, useState } from 'react';
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
import SignupPage from './pages/auth/SignupPage';
import UserAccessPage from './pages/users/UserAccessPage';
import type { BusinessUserSummary, SessionUser } from './auth/types';

async function readApiJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<BusinessUserSummary[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);

  const canManageUsers =
    sessionUser?.role === 'owner' || sessionUser?.role === 'admin';

  const loadUsers = async () => {
    if (!sessionUser || !canManageUsers) {
      setUsers([]);
      return;
    }

    const response = await fetch('/api/users', {
      method: 'GET',
      credentials: 'include',
    });
    const payload = await readApiJson<{ ok: boolean; users?: BusinessUserSummary[] }>(response);

    if (!response.ok || !payload?.ok || !Array.isArray(payload.users)) {
      setUsers([]);
      return;
    }

    setUsers(payload.users);
  };

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });

      const payload = await readApiJson<{ ok: boolean; user?: SessionUser }>(response);
      if (response.ok && payload?.ok && payload.user) {
        setSessionUser(payload.user);
      } else {
        setSessionUser(null);
      }

      setLoadingSession(false);
    };

    void loadSession();
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [sessionUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const payload = await readApiJson<{ ok: boolean; user?: SessionUser }>(response);
    if (!response.ok || !payload?.ok || !payload.user) {
      return false;
    }

    setSessionUser(payload.user);
    await loadUsers();
    return true;
  };

  const signup = async (payload: {
    businessName: string;
    ownerName: string;
    email: string;
    password: string;
  }) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body = await readApiJson<{ ok: boolean; user?: SessionUser; error?: string }>(response);
    if (!response.ok || !body?.ok || !body.user) {
      return { ok: false, error: body?.error ?? 'Could not create account.' };
    }

    setSessionUser(body.user);
    await loadUsers();
    return { ok: true };
  };

  const createUser = async (payload: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'employee';
  }) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const body = await readApiJson<{ ok: boolean; error?: string }>(response);

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? 'Could not create user.' };
    }

    await loadUsers();
    return { ok: true };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setSessionUser(null);
    setUsers([]);
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="employee-login" element={<EmployeePortalPage />} />

        {sessionUser ? (
          <>
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route path="signup" element={<Navigate to="/" replace />} />
            <Route
              element={
                <AppLayout
                  userName={sessionUser.name}
                  businessName={sessionUser.businessName}
                  userRole={sessionUser.role}
                  onLogout={logout}
                />
              }
            >
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
              <Route
                path="user-access"
                element={
                  canManageUsers ? (
                    <UserAccessPage
                      users={users}
                      currentUserRole={sessionUser.role}
                      onCreateUser={createUser}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="login" element={<LoginPage onLogin={login} />} />
            <Route path="signup" element={<SignupPage onSignup={signup} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
