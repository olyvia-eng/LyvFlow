import {
  createBudgetItemForBusiness,
  createAuditEventForBusiness,
  createCustomerForBusiness,
  createEmployeeForBusiness,
  createEquipmentAssetForBusiness,
  createEstimateForBusiness,
  createExpenseForBusiness,
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
  deleteEquipmentAssetForBusiness,
  deleteEstimateForBusiness,
  deleteExpenseForBusiness,
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
  getEquipmentAssetForBusiness,
  getEstimateForBusiness,
  getExpenseForBusiness,
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
  listEquipmentAssetsForBusiness,
  listEstimatesForBusiness,
  listExpensesForBusiness,
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
  updateEquipmentAssetForBusiness,
  updateEstimateForBusiness,
  updateExpenseForBusiness,
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
  expenses: {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listExpensesForBusiness,
    get: getExpenseForBusiness,
    create: createExpenseForBusiness,
    update: updateExpenseForBusiness,
    remove: deleteExpenseForBusiness,
    payloadKey: 'expense',
    idParam: 'expenseId',
    createArgKey: 'expense',
    updateArgKey: 'expense',
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
  'equipment-assets': {
    readRoles: null,
    writeRoles: ['owner', 'admin'],
    list: listEquipmentAssetsForBusiness,
    get: getEquipmentAssetForBusiness,
    create: createEquipmentAssetForBusiness,
    update: updateEquipmentAssetForBusiness,
    remove: deleteEquipmentAssetForBusiness,
    payloadKey: 'equipmentAsset',
    idParam: 'equipmentId',
    createArgKey: 'equipmentAsset',
    updateArgKey: 'equipmentAsset',
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

const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'overdue']);
const EXPENSE_STATUSES = new Set(['pending', 'approved', 'paid']);
const EXPENSE_CATEGORIES = new Set(['materials', 'equipment', 'subcontractor', 'travel', 'permits', 'overhead', 'other']);
const EQUIPMENT_STATUSES = new Set(['available', 'in_use', 'maintenance', 'inactive']);
const EQUIPMENT_COST_TYPES = new Set(['financed', 'leased', 'owned']);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateInvoiceRecord(record) {
  if (!isNonEmptyString(record.id)) return 'Invoice id is required.';
  if (!isNonEmptyString(record.jobId)) return 'Invoice job is required.';
  if (!isNonEmptyString(record.customerId)) return 'Invoice customer is required.';
  if (!isNonEmptyString(record.number)) return 'Invoice number is required.';
  if (!isValidDateOnly(record.issueDate)) return 'Invoice issue date must use YYYY-MM-DD format.';
  if (!isValidDateOnly(record.dueDate)) return 'Invoice due date must use YYYY-MM-DD format.';
  if (!INVOICE_STATUSES.has(record.status)) return 'Invoice status is invalid.';
  if (typeof record.amount !== 'number' || Number.isNaN(record.amount) || record.amount <= 0) {
    return 'Invoice amount must be greater than 0.';
  }
  return null;
}

function validateExpenseRecord(record) {
  if (!isNonEmptyString(record.id)) return 'Expense id is required.';
  if (!isNonEmptyString(record.vendor)) return 'Vendor is required.';
  if (!isNonEmptyString(record.description)) return 'Description is required.';
  if (!EXPENSE_CATEGORIES.has(record.category)) return 'Expense category is invalid.';
  if (!isValidDateOnly(record.expenseDate)) return 'Expense date must use YYYY-MM-DD format.';
  if (typeof record.amount !== 'number' || Number.isNaN(record.amount) || record.amount <= 0) {
    return 'Expense amount must be greater than 0.';
  }
  if (!EXPENSE_STATUSES.has(record.status)) return 'Expense status is invalid.';
  if (typeof record.notes !== 'string') return 'Expense notes must be a string.';
  if (record.receiptUrl !== undefined && record.receiptUrl !== null && typeof record.receiptUrl !== 'string') {
    return 'Expense receipt URL is invalid.';
  }
  if (record.jobId !== undefined && record.jobId !== null && typeof record.jobId !== 'string') {
    return 'Expense job is invalid.';
  }
  return null;
}

function validateEquipmentAssetRecord(record) {
  if (!isNonEmptyString(record.id)) return 'Equipment id is required.';
  if (!isNonEmptyString(record.name)) return 'Equipment name is required.';
  if (!isNonEmptyString(record.type)) return 'Equipment type is required.';
  if (!EQUIPMENT_STATUSES.has(record.status)) return 'Equipment status is invalid.';
  if (!EQUIPMENT_COST_TYPES.has(record.costType)) return 'Equipment cost type is invalid.';
  if (record.serialNumber !== undefined && record.serialNumber !== null && typeof record.serialNumber !== 'string') {
    return 'Equipment serial number is invalid.';
  }
  if (record.purchaseDate !== undefined && record.purchaseDate !== null && record.purchaseDate !== '' && !isValidDateOnly(record.purchaseDate)) {
    return 'Equipment purchase date must use YYYY-MM-DD format.';
  }
  if (typeof record.hourlyCost !== 'number' || Number.isNaN(record.hourlyCost) || record.hourlyCost < 0) {
    return 'Equipment hourly cost must be zero or greater.';
  }
  if (record.currentJobId !== undefined && record.currentJobId !== null && typeof record.currentJobId !== 'string') {
    return 'Equipment job assignment is invalid.';
  }
  if (typeof record.notes !== 'string') return 'Equipment notes must be a string.';
  return null;
}

async function findInvoiceNumberConflict({ businessId, invoiceNumber, excludeInvoiceId }) {
  if (!isNonEmptyString(invoiceNumber)) return null;

  const normalizedNumber = invoiceNumber.trim().toLowerCase();
  const invoices = await listInvoicesForBusiness(businessId);
  return invoices.find((invoice) => {
    if (excludeInvoiceId && invoice.id === excludeInvoiceId) return false;
    return typeof invoice.number === 'string' && invoice.number.trim().toLowerCase() === normalizedNumber;
  }) ?? null;
}

async function findProposalNumberConflict({ businessId, proposalNumber, excludeEstimateId }) {
  if (!isNonEmptyString(proposalNumber)) return null;

  const normalizedNumber = proposalNumber.trim().toLowerCase();
  const estimates = await listEstimatesForBusiness(businessId);
  return estimates.find((estimate) => {
    if (excludeEstimateId && estimate.id === excludeEstimateId) return false;
    return typeof estimate.proposalNumber === 'string' && estimate.proposalNumber.trim().toLowerCase() === normalizedNumber;
  }) ?? null;
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

    if (entity === 'invoices') {
      const validationError = validateInvoiceRecord(record);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }

      const conflict = await findInvoiceNumberConflict({
        businessId: session.businessId,
        invoiceNumber: record.number,
      });

      if (conflict) {
        return res.status(409).json({ ok: false, error: 'Invoice number already exists.' });
      }
    }

    if (entity === 'estimates') {
      const conflict = await findProposalNumberConflict({
        businessId: session.businessId,
        proposalNumber: record.proposalNumber,
      });

      if (conflict) {
        return res.status(409).json({ ok: false, error: 'Proposal number already exists.' });
      }
    }

    if (entity === 'expenses') {
      const validationError = validateExpenseRecord(record);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }
    }

    if (entity === 'equipment-assets') {
      const validationError = validateEquipmentAssetRecord(record);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }
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

      if (entity === 'invoices') {
        const validationError = validateInvoiceRecord(next);
        if (validationError) {
          return res.status(400).json({ ok: false, error: validationError });
        }

        const conflict = await findInvoiceNumberConflict({
          businessId: session.businessId,
          invoiceNumber: next.number,
          excludeInvoiceId: id,
        });

        if (conflict) {
          return res.status(409).json({ ok: false, error: 'Invoice number already exists.' });
        }
      }

      if (entity === 'estimates') {
        const conflict = await findProposalNumberConflict({
          businessId: session.businessId,
          proposalNumber: next.proposalNumber,
          excludeEstimateId: id,
        });

        if (conflict) {
          return res.status(409).json({ ok: false, error: 'Proposal number already exists.' });
        }
      }

      if (entity === 'expenses') {
        const validationError = validateExpenseRecord(next);
        if (validationError) {
          return res.status(400).json({ ok: false, error: validationError });
        }
      }

      if (entity === 'equipment-assets') {
        const validationError = validateEquipmentAssetRecord(next);
        if (validationError) {
          return res.status(400).json({ ok: false, error: validationError });
        }
      }

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
