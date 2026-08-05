import {
  createBudgetItemForBusiness,
  createAuditEventForBusiness,
  createCustomerForBusiness,
  createEmployeeForBusiness,
  createEstimateForBusiness,
  createInvoiceForBusiness,
  createJobForBusiness,
  createRevenueSalesGoalForBusiness,
  createLabourHoursSalesGoalForBusiness,
  createLabourBudgetPlanForBusiness,
  createTemplateForBusiness,
  createTimeEntryForBusiness,
  deleteAuthUserForBusinessByEmail,
  deleteBudgetItemForBusiness,
  deleteAuditEventForBusiness,
  deleteCustomerForBusiness,
  deleteEmployeeForBusiness,
  deleteEstimateForBusiness,
  deleteInvoiceForBusiness,
  deleteJobForBusiness,
  deleteRevenueSalesGoalForBusiness,
  deleteLabourHoursSalesGoalForBusiness,
  deleteLabourBudgetPlanForBusiness,
  deleteTemplateForBusiness,
  deleteTimeEntryForBusiness,
  getBudgetItemForBusiness,
  getAuditEventForBusiness,
  getCustomerForBusiness,
  getEmployeeForBusiness,
  getEstimateForBusiness,
  getInvoiceForBusiness,
  getJobForBusiness,
  getRevenueSalesGoalForBusiness,
  getLabourHoursSalesGoalForBusiness,
  getLabourBudgetPlanForBusiness,
  getTemplateForBusiness,
  getTimeEntryForBusiness,
  listBudgetItemsForBusiness,
  listAuditEventsForBusiness,
  listCustomersForBusiness,
  listEmployeesForBusiness,
  listEstimatesForBusiness,
  listInvoicesForBusiness,
  listJobsForBusiness,
  listRevenueSalesGoalsForBusiness,
  listLabourHoursSalesGoalsForBusiness,
  listLabourBudgetPlansForBusiness,
  listTemplatesForBusiness,
  listTimeEntriesForBusiness,
  updateBudgetItemForBusiness,
  updateAuditEventForBusiness,
  updateCustomerForBusiness,
  updateEmployeeForBusiness,
  updateEstimateForBusiness,
  updateInvoiceForBusiness,
  updateJobForBusiness,
  updateRevenueSalesGoalForBusiness,
  updateLabourHoursSalesGoalForBusiness,
  updateLabourBudgetPlanForBusiness,
  updateTemplateForBusiness,
  updateTimeEntryForBusiness,
} from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

const ENTITY_CONFIG = {
  customers: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listCustomersForBusiness,
    get: getCustomerForBusiness,
    create: createCustomerForBusiness,
    update: updateCustomerForBusiness,
    remove: deleteCustomerForBusiness,
    payloadKey: 'customer',
    idParam: 'customerId',
    createArgKey: 'customer',
    updateArgKey: 'customer',
  },
  jobs: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listJobsForBusiness,
    get: getJobForBusiness,
    create: createJobForBusiness,
    update: updateJobForBusiness,
    remove: deleteJobForBusiness,
    payloadKey: 'job',
    idParam: 'jobId',
    createArgKey: 'job',
    updateArgKey: 'job',
  },
  estimates: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listEstimatesForBusiness,
    get: getEstimateForBusiness,
    create: createEstimateForBusiness,
    update: updateEstimateForBusiness,
    remove: deleteEstimateForBusiness,
    payloadKey: 'estimate',
    idParam: 'estimateId',
    createArgKey: 'estimate',
    updateArgKey: 'estimate',
  },
  templates: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listTemplatesForBusiness,
    get: getTemplateForBusiness,
    create: createTemplateForBusiness,
    update: updateTemplateForBusiness,
    remove: deleteTemplateForBusiness,
    payloadKey: 'template',
    idParam: 'templateId',
    createArgKey: 'template',
    updateArgKey: 'template',
  },
  invoices: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listInvoicesForBusiness,
    get: getInvoiceForBusiness,
    create: createInvoiceForBusiness,
    update: updateInvoiceForBusiness,
    remove: deleteInvoiceForBusiness,
    payloadKey: 'invoice',
    idParam: 'invoiceId',
    createArgKey: 'invoice',
    updateArgKey: 'invoice',
  },
  budget: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listBudgetItemsForBusiness,
    get: getBudgetItemForBusiness,
    create: createBudgetItemForBusiness,
    update: updateBudgetItemForBusiness,
    remove: deleteBudgetItemForBusiness,
    payloadKey: 'budgetItem',
    idParam: 'budgetItemId',
    createArgKey: 'budgetItem',
    updateArgKey: 'budgetItem',
  },
  'labour-budget-plans': {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listLabourBudgetPlansForBusiness,
    get: getLabourBudgetPlanForBusiness,
    create: createLabourBudgetPlanForBusiness,
    update: updateLabourBudgetPlanForBusiness,
    remove: deleteLabourBudgetPlanForBusiness,
    payloadKey: 'labourBudgetPlan',
    idParam: 'labourBudgetPlanId',
    createArgKey: 'labourBudgetPlan',
    updateArgKey: 'labourBudgetPlan',
  },
  'labour-hours-sales-goals': {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listLabourHoursSalesGoalsForBusiness,
    get: getLabourHoursSalesGoalForBusiness,
    create: createLabourHoursSalesGoalForBusiness,
    update: updateLabourHoursSalesGoalForBusiness,
    remove: deleteLabourHoursSalesGoalForBusiness,
    payloadKey: 'labourHoursSalesGoal',
    idParam: 'labourHoursSalesGoalId',
    createArgKey: 'labourHoursSalesGoal',
    updateArgKey: 'labourHoursSalesGoal',
  },
  'revenue-sales-goals': {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listRevenueSalesGoalsForBusiness,
    get: getRevenueSalesGoalForBusiness,
    create: createRevenueSalesGoalForBusiness,
    update: updateRevenueSalesGoalForBusiness,
    remove: deleteRevenueSalesGoalForBusiness,
    payloadKey: 'revenueSalesGoal',
    idParam: 'revenueSalesGoalId',
    createArgKey: 'revenueSalesGoal',
    updateArgKey: 'revenueSalesGoal',
  },
  employees: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listEmployeesForBusiness,
    get: getEmployeeForBusiness,
    create: createEmployeeForBusiness,
    update: updateEmployeeForBusiness,
    remove: deleteEmployeeForBusiness,
    payloadKey: 'employee',
    idParam: 'employeeId',
    createArgKey: 'employee',
    updateArgKey: 'employee',
  },
  'time-entries': {
    readRoles: null,
    writeRoles: null,
    list: listTimeEntriesForBusiness,
    get: getTimeEntryForBusiness,
    create: createTimeEntryForBusiness,
    update: updateTimeEntryForBusiness,
    remove: deleteTimeEntryForBusiness,
    payloadKey: 'timeEntry',
    idParam: 'entryId',
    createArgKey: 'timeEntry',
    updateArgKey: 'timeEntry',
  },
  'audit-events': {
    readRoles: ['owner', 'admin'],
    writeRoles: ['owner', 'admin'],
    list: listAuditEventsForBusiness,
    get: getAuditEventForBusiness,
    create: createAuditEventForBusiness,
    update: updateAuditEventForBusiness,
    remove: deleteAuditEventForBusiness,
    payloadKey: 'auditEvent',
    idParam: 'eventId',
    createArgKey: 'auditEvent',
    updateArgKey: 'auditEvent',
  },
};

function getConfig(entity) {
  return entity ? ENTITY_CONFIG[entity] : undefined;
}

export default async function handler(req, res) {
  const entity = req.query.entity;
  const config = getConfig(entity);
  if (!config) {
    return res.status(400).json({ ok: false, error: 'Invalid data entity' });
  }

  if (req.method === 'GET') {
    const session = requireSession(req, res, config.readRoles ?? undefined);
    if (!session) return;

    try {
      const items = await config.list(session.businessId);
      return res.status(200).json({ ok: true, items });
    } catch {
      return res.status(500).json({ ok: false, error: `Could not load ${entity}` });
    }
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res, config.writeRoles ?? undefined);
    if (!session) return;

    const record = req.body?.data;
    if (!record || typeof record !== 'object' || typeof record.id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      await config.create({ businessId: session.businessId, [config.createArgKey]: record });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: `Could not create ${entity}` });
    }
  }

  if (req.method === 'PATCH') {
    const session = requireSession(req, res, config.writeRoles ?? undefined);
    if (!session) return;

    const id = req.query.id;
    const data = req.body?.data;
    if (typeof id !== 'string' || !id || !data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    try {
      const existing = await config.get(session.businessId, id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: `${entity} not found` });
      }

      const next = { ...existing, ...data };
      await config.update({ businessId: session.businessId, [config.updateArgKey]: next });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: `Could not update ${entity}` });
    }
  }

  if (req.method === 'DELETE') {
    const session = requireSession(req, res, config.writeRoles ?? undefined);
    if (!session) return;

    const id = req.query.id;
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ ok: false, error: 'Invalid id' });
    }

    try {
      if (entity === 'employees') {
        const existing = await getEmployeeForBusiness(session.businessId, id);
        if (existing?.email) {
          const authDelete = await deleteAuthUserForBusinessByEmail(session.businessId, existing.email);
          if (!authDelete.ok) {
            return res.status(409).json({ ok: false, error: authDelete.error });
          }
        }
      }

      await config.remove(session.businessId, id);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, error: `Could not delete ${entity}` });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
