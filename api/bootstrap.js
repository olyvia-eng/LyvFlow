import {
  listFormsForBusiness,
  listFormFieldsForBusiness,
  listFormSubmissionsForBusiness,
  listFormResponsesForBusiness,
  listBudgetsForBusiness,
  listRevenueSalesGoalsForBusiness,
  listLabourHoursSalesGoalsForBusiness,
  listLabourBudgetPlansForBusiness,
  listBudgetItemsForBusiness,
  listCustomersForBusiness,
  listEmployeesForBusiness,
  listEquipmentAssetsForBusiness,
  listMaterialCatalogItemsForBusiness,
  listEstimatesForBusiness,
  listExpensesForBusiness,
  listInvoicesForBusiness,
  listJobsForBusiness,
  listTemplatesForBusiness,
  listTimeEntriesForBusiness,
} from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';
import { filterRecordsForSession } from './_lib/authorization.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const [forms, formFields, formSubmissions, formResponses, budgets, customers, jobs, estimates, invoices, expenses, equipmentAssets, materialCatalogItems, templates, budgetItems, labourBudgetPlans, labourHoursSalesGoals, revenueSalesGoals, employees, timeEntries] = await Promise.all([
      listFormsForBusiness(session.businessId),
      listFormFieldsForBusiness(session.businessId),
      listFormSubmissionsForBusiness(session.businessId),
      listFormResponsesForBusiness(session.businessId),
      listBudgetsForBusiness(session.businessId),
      listCustomersForBusiness(session.businessId),
      listJobsForBusiness(session.businessId),
      listEstimatesForBusiness(session.businessId),
      listInvoicesForBusiness(session.businessId),
      listExpensesForBusiness(session.businessId),
      listEquipmentAssetsForBusiness(session.businessId),
      listMaterialCatalogItemsForBusiness(session.businessId),
      listTemplatesForBusiness(session.businessId),
      listBudgetItemsForBusiness(session.businessId),
      listLabourBudgetPlansForBusiness(session.businessId),
      listLabourHoursSalesGoalsForBusiness(session.businessId),
      listRevenueSalesGoalsForBusiness(session.businessId),
      listEmployeesForBusiness(session.businessId),
      listTimeEntriesForBusiness(session.businessId),
    ]);

    return res.status(200).json({
      ok: true,
      forms: filterRecordsForSession(session, 'forms', forms),
      formFields: filterRecordsForSession(session, 'form-fields', formFields),
      formSubmissions: filterRecordsForSession(session, 'form-submissions', formSubmissions),
      formResponses: filterRecordsForSession(session, 'form-responses', formResponses),
      budgets: filterRecordsForSession(session, 'budgets', budgets),
      customers: filterRecordsForSession(session, 'customers', customers),
      jobs: filterRecordsForSession(session, 'jobs', jobs),
      estimates: filterRecordsForSession(session, 'estimates', estimates),
      invoices: filterRecordsForSession(session, 'invoices', invoices),
      expenses: filterRecordsForSession(session, 'expenses', expenses),
      equipmentAssets: filterRecordsForSession(session, 'equipment-assets', equipmentAssets),
      materialCatalogItems: filterRecordsForSession(session, 'material-catalog-items', materialCatalogItems),
      templates: filterRecordsForSession(session, 'templates', templates),
      budgetItems: filterRecordsForSession(session, 'budget', budgetItems),
      labourBudgetPlans: filterRecordsForSession(session, 'labour-budget-plans', labourBudgetPlans),
      labourHoursSalesGoals: filterRecordsForSession(session, 'labour-hours-sales-goals', labourHoursSalesGoals),
      revenueSalesGoals: filterRecordsForSession(session, 'revenue-sales-goals', revenueSalesGoals),
      employees: filterRecordsForSession(session, 'employees', employees),
      timeEntries: filterRecordsForSession(session, 'time-entries', timeEntries),
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Could not load business data' });
  }
}
