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
import ModulePlaceholderPage from './pages/placeholders/ModulePlaceholderPage';
import InvoicesPage from './pages/finance/InvoicesPage';
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
      <div className="min-h-screen flex items-center justify-center bg-cream text-brand-400 text-sm">
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
                ? 'border-brand-200 bg-brand-50 text-brand-800'
                : 'border-accent-100 bg-accent-50 text-accent-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
      {sessionUser && businessDataError && (
        <div className="fixed top-4 left-4 right-4 z-[90] sm:left-auto sm:right-4 sm:max-w-md">
          <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 shadow-lg">
            <p className="font-medium">Business data could not be loaded.</p>
            <p className="mt-1 text-accent-700">{businessDataError}</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void loadBusinessData(sessionUser)}
                className="inline-flex items-center rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              path="/"
              element={
                <AppLayout
                  userName={sessionUser.name}
                  userEmail={sessionUser.email}
                  businessName={sessionUser.businessName}
                  userRole={sessionUser.role}
                  onLogout={logout}
                />
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="crm" element={<CRMPage />} />
              <Route path="revenue/dashboard" element={<RevenueDashboardPage />} />
              <Route
                path="revenue/leads"
                element={
                  <ModulePlaceholderPage
                    title="Leads"
                    question="Which leads should we prioritize this week to protect future revenue?"
                    summary="Track and rank pipeline opportunities by value, close probability, and urgency so sales focus stays clear and measurable."
                  />
                }
              />
              <Route
                path="revenue/change-orders"
                element={
                  <ModulePlaceholderPage
                    title="Change Orders"
                    question="Which scope changes are waiting for approval and what revenue is at risk?"
                    summary="Review pending and approved change orders in one place to keep job margin and billing aligned with real field work."
                  />
                }
              />
              <Route path="finance/dashboard" element={<FinanceDashboardPage />} />
              <Route path="finance/invoices" element={<InvoicesPage />} />
              <Route
                path="finance/expenses"
                element={
                  <ModulePlaceholderPage
                    title="Expenses"
                    question="Where is money being spent and are costs staying inside plan?"
                    summary="Capture and categorize expenses with simple controls so cost trends are easy to review and decisions can be made early."
                  />
                }
              />
              <Route
                path="finance/profit-loss"
                element={
                  <ModulePlaceholderPage
                    title="Profit & Loss"
                    question="Are we profitable this period, and what is driving the result?"
                    summary="Summarize revenue, direct costs, overhead, and margin in a contractor-friendly view for fast executive review."
                  />
                }
              />
              <Route path="operations/dashboard" element={<OperationsDashboardPage />} />
              <Route
                path="operations/equipment"
                element={
                  <ModulePlaceholderPage
                    title="Equipment"
                    question="What equipment is available, assigned, or underutilized right now?"
                    summary="Coordinate field equipment status and assignments so crews have what they need without unnecessary rental or idle cost."
                  />
                }
              />
              <Route
                path="operations/inventory"
                element={
                  <ModulePlaceholderPage
                    title="Inventory"
                    question="Which materials are running low and could delay upcoming work?"
                    summary="Monitor key stock levels and reorder signals to prevent job delays while avoiding over-purchasing."
                  />
                }
              />
              <Route
                path="materials/catalog"
                element={
                  <ModulePlaceholderPage
                    title="Material Catalog"
                    question="What standard materials do we price and use most often?"
                    summary="Maintain a shared list of material standards and pricing references so estimates stay consistent and fast."
                  />
                }
              />
              <Route
                path="operations/purchase-orders"
                element={
                  <ModulePlaceholderPage
                    title="Purchase Orders"
                    question="What purchases are approved, pending, and tied to active jobs?"
                    summary="Track PO lifecycle clearly so project commitments, vendor communication, and budget control stay in sync."
                  />
                }
              />
              <Route path="employees/dashboard" element={<EmployeesDashboardPage />} />
              <Route
                path="employees/payroll"
                element={
                  <ModulePlaceholderPage
                    title="Payroll"
                    question="Are labour hours and pay ready for accurate payroll processing?"
                    summary="Review payable hours, adjustments, and payroll readiness so finance can process confidently without manual reconciliation."
                  />
                }
              />
              <Route
                path="employees/certifications"
                element={
                  <ModulePlaceholderPage
                    title="Certifications"
                    question="Who is certified for upcoming work and who needs renewal soon?"
                    summary="Surface expiration risk and qualification coverage so job staffing decisions remain compliant and practical."
                  />
                }
              />
              <Route path="data-center/dashboard" element={<DataCenterDashboardPage />} />
              <Route
                path="data-center/documents"
                element={
                  <ModulePlaceholderPage
                    title="Documents"
                    question="Where are the latest project documents and who can access them?"
                    summary="Centralize important files by department and job context to reduce searching and keep teams aligned on current information."
                  />
                }
              />
              <Route
                path="data-center/forms"
                element={
                  <ModulePlaceholderPage
                    title="Forms"
                    question="Which operational forms are required and are they being completed consistently?"
                    summary="Standardize field and office form workflows to improve accountability and reduce missed compliance steps."
                  />
                }
              />
              <Route
                path="data-center/photos"
                element={
                  <ModulePlaceholderPage
                    title="Photos"
                    question="Do we have visual records of project progress and key field conditions?"
                    summary="Organize photo evidence by job and timeline so teams can quickly reference progress, quality, and issues."
                  />
                }
              />
              <Route
                path="data-center/settings"
                element={
                  <ModulePlaceholderPage
                    title="Data Center Settings"
                    question="Are data organization rules and access settings configured for reliable operations?"
                    summary="Manage retention, structure, and permissions so business data stays organized, secure, and easy to use."
                  />
                }
              />
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
