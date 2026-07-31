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
import TimeReportsPage from './pages/reports/TimeReportsPage';
import EmployeePortalPage from './pages/employees/EmployeePortalPage';
import CalendarPage from './pages/calendar/CalendarPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import UserAccessPage from './pages/users/UserAccessPage';
import RevenueDashboardPage from './pages/department-dashboards/RevenueDashboardPage';
import FinanceDashboardPage from './pages/department-dashboards/FinanceDashboardPage';
import OperationsDashboardPage from './pages/department-dashboards/OperationsDashboardPage';
import EmployeesDashboardPage from './pages/department-dashboards/EmployeesDashboardPage';
import DataCenterDashboardPage from './pages/department-dashboards/DataCenterDashboardPage';
import type { BusinessUserSummary, SessionUser } from './auth/types';
import { useStore } from './store';
import type { BudgetItem, Customer, Employee, Estimate, EstimateTemplate, Job, LabourBudgetPlan, LabourHoursSalesGoal, RevenueSalesGoal, TimeEntry } from './types';
import { APP_TOAST_EVENT, type AppToastDetail, emitAppToast } from './toast';

const STORE_OWNER_KEY = 'oliveops.store.ownerBusinessId';

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
  const [loadingBusinessData, setLoadingBusinessData] = useState(false);
  const [hasLoadedBusinessData, setHasLoadedBusinessData] = useState(false);
  const [businessDataError, setBusinessDataError] = useState('');
  const [toasts, setToasts] = useState<Array<AppToastDetail & { id: number }>>([]);

  const canManageUsers =
    sessionUser?.role === 'owner' || sessionUser?.role === 'admin';
  const canViewReports = sessionUser?.role === 'owner' || sessionUser?.role === 'admin';

  const loadBusinessData = async (user: SessionUser | null = sessionUser) => {
    if (!user) {
      setHasLoadedBusinessData(false);
      setBusinessDataError('');
      return;
    }

    setLoadingBusinessData(true);
    setBusinessDataError('');

    try {
      const response = await fetch('/api/bootstrap', {
        method: 'GET',
        credentials: 'include',
      });

      const payload = await readApiJson<{
        ok: boolean;
        customers?: Customer[];
        jobs?: Job[];
        estimates?: Estimate[];
        templates?: EstimateTemplate[];
        budgetItems?: BudgetItem[];
        labourBudgetPlans?: LabourBudgetPlan[];
        labourHoursSalesGoals?: LabourHoursSalesGoal[];
        revenueSalesGoals?: RevenueSalesGoal[];
        employees?: Employee[];
        timeEntries?: TimeEntry[];
      }>(response);

      if (!response.ok || !payload?.ok) {
        setBusinessDataError('Could not load business data. Please retry.');
        return;
      }

      useStore.setState((state) => ({
        ...state,
        customers: payload.customers ?? [],
        jobs: payload.jobs ?? [],
        estimates: payload.estimates ?? [],
        templates: payload.templates ?? [],
        budgetItems: payload.budgetItems ?? [],
        labourBudgetPlans: payload.labourBudgetPlans ?? [],
        labourHoursSalesGoals: payload.labourHoursSalesGoals ?? [],
        revenueSalesGoals: payload.revenueSalesGoals ?? [],
        employees: payload.employees ?? [],
        timeEntries: payload.timeEntries ?? [],
      }));
      setBusinessDataError('');
    } catch {
      setBusinessDataError('Could not load business data. Please retry.');
    } finally {
      setLoadingBusinessData(false);
      setHasLoadedBusinessData(true);
    }
  };

  const loadUsers = async (user: SessionUser | null = sessionUser) => {
    const canManage = user?.role === 'owner' || user?.role === 'admin';
    if (!user || !canManage) {
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
      const response = await fetch('/api/auth?action=session', {
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
    const handleToast = (event: Event) => {
      const custom = event as CustomEvent<AppToastDetail>;
      const detail = custom.detail;
      if (!detail?.message) return;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current, { id, tone: 'error', ...detail }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3500);
    };

    window.addEventListener(APP_TOAST_EVENT, handleToast as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT, handleToast as EventListener);
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setUsers([]);
      setHasLoadedBusinessData(false);
      return;
    }

    setHasLoadedBusinessData(false);
    void loadUsers(sessionUser);
    void loadBusinessData(sessionUser);
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;

    const previousOwner = localStorage.getItem(STORE_OWNER_KEY);
    if (previousOwner === sessionUser.businessId) return;

    useStore.setState({
      customers: [],
      estimates: [],
      templates: [],
      jobs: [],
      employees: [],
      timeEntries: [],
      budgetItems: [],
      labourBudgetPlans: [],
      labourHoursSalesGoals: [],
      revenueSalesGoals: [],
    });
    localStorage.setItem(STORE_OWNER_KEY, sessionUser.businessId);
  }, [sessionUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const response = await fetch('/api/auth?action=login', {
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
    await loadUsers(payload.user);
    await loadBusinessData(payload.user);
    return true;
  };

  const signup = async (payload: {
    businessName: string;
    ownerName: string;
    email: string;
    password: string;
  }) => {
    const response = await fetch('/api/auth?action=signup', {
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
    await loadUsers(body.user);
    await loadBusinessData(body.user);
    return { ok: true };
  };

  const createUser = async (payload: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'foreman' | 'crew_member';
  }) => {
    let response: Response;
    try {
      response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, error: 'Could not reach the API. Run npm run dev:full for local API routes.' };
    }

    const body = await readApiJson<{ ok: boolean; error?: string }>(response);

    if (!response.ok || !body?.ok) {
      if (!body?.error && response.status === 404) {
        return { ok: false, error: 'API route unavailable. Run npm run dev:full for local API routes.' };
      }
      if (!body?.error && response.status === 401) {
        return { ok: false, error: 'Your session expired. Please log in again.' };
      }
      if (!body?.error && response.status === 403) {
        return { ok: false, error: 'You do not have permission to create users.' };
      }
      if (!body?.error) {
        return { ok: false, error: `Could not create user (HTTP ${response.status}).` };
      }
      return { ok: false, error: body.error };
    }

    await loadUsers();
    emitAppToast({ tone: 'success', message: 'User created successfully.' });
    return { ok: true };
  };

  const updateUser = async (userId: string, data: { role?: 'admin' | 'foreman' | 'crew_member'; active?: boolean }) => {
    const response = await fetch(`/api/users?id=${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ data }),
    });
    const body = await readApiJson<{ ok: boolean; error?: string }>(response);

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? 'Could not update user.' };
    }

    await loadUsers();
    emitAppToast({ tone: 'success', message: 'User updated successfully.' });
    return { ok: true };
  };

  const deleteUser = async (userId: string) => {
    const response = await fetch(`/api/users?id=${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = await readApiJson<{ ok: boolean; error?: string }>(response);

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? 'Could not delete user.' };
    }

    await loadUsers();
    emitAppToast({ tone: 'success', message: 'User deleted successfully.' });
    return { ok: true };
  };

  const logout = async () => {
    await fetch('/api/auth?action=logout', {
      method: 'POST',
      credentials: 'include',
    });
    setSessionUser(null);
    setHasLoadedBusinessData(false);
    setBusinessDataError('');
    setUsers([]);
  };

  const showBusinessDataLoading = Boolean(sessionUser) && (loadingBusinessData || !hasLoadedBusinessData);

  if (loadingSession || showBusinessDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Loading business data...
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-64 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
      {sessionUser && businessDataError && (
        <div className="fixed top-4 left-4 right-4 z-[90] sm:left-auto sm:right-4 sm:max-w-md">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">
            <p className="font-medium">Business data could not be loaded.</p>
            <p className="mt-1 text-amber-800">{businessDataError}</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void loadBusinessData(sessionUser)}
                className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingBusinessData}
              >
                {loadingBusinessData ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BrowserRouter>
      <Routes>
        <Route
          path="employee-login"
          element={
            sessionUser?.role === 'crew_member' || sessionUser?.role === 'foreman' ? (
              <EmployeePortalPage
                sessionEmployeeEmail={sessionUser.email}
                onLogout={logout}
              />
            ) : (
              <Navigate to={sessionUser ? '/' : '/login'} replace />
            )
          }
        />

        {sessionUser ? (
          sessionUser.role === 'crew_member' || sessionUser.role === 'foreman' ? (
            <>
              <Route path="login" element={<Navigate to="/employee-login" replace />} />
              <Route path="signup" element={<Navigate to="/employee-login" replace />} />
              <Route path="*" element={<Navigate to="/employee-login" replace />} />
            </>
          ) : (
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
              <Route path="revenue/dashboard" element={<RevenueDashboardPage />} />
              <Route path="finance/dashboard" element={<FinanceDashboardPage />} />
              <Route path="operations/dashboard" element={<OperationsDashboardPage />} />
              <Route path="employees/dashboard" element={<EmployeesDashboardPage />} />
              <Route path="data-center/dashboard" element={<DataCenterDashboardPage />} />
              <Route path="estimates" element={<EstimatesPage />} />
              <Route path="estimates/templates" element={<TemplatesPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="jobs/:id" element={<JobDetailPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="data-center" element={<DataCenterPage />} />
              <Route
                path="time-reports"
                element={
                  canViewReports ? (
                    <TimeReportsPage
                      currentUserRole={sessionUser.role}
                      currentUserId={sessionUser.id}
                      currentUserName={sessionUser.name}
                      currentUserEmail={sessionUser.email}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="user-access"
                element={
                  canManageUsers ? (
                    <UserAccessPage
                      users={users}
                      currentUserRole={sessionUser.role}
                      onCreateUser={createUser}
                      onUpdateUser={updateUser}
                      onDeleteUser={deleteUser}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
          )
        ) : (
          <>
            <Route path="login" element={<LoginPage onLogin={login} />} />
            <Route path="signup" element={<SignupPage onSignup={signup} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
    </>
  );
}
