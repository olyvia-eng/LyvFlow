import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="employee-login" element={<EmployeePortalPage />} />
        <Route element={<AppLayout />}>
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
      </Routes>
    </BrowserRouter>
  );
}
