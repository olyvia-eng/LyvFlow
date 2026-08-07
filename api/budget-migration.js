import {
  listBudgetsForBusiness,
  createBudgetForBusiness,
  listBudgetItemsForBusiness,
  listLabourBudgetPlansForBusiness,
  listLabourHoursSalesGoalsForBusiness,
  listRevenueSalesGoalsForBusiness,
  updateBudgetItemForBusiness,
  updateLabourBudgetPlanForBusiness,
  updateLabourHoursSalesGoalForBusiness,
  updateRevenueSalesGoalForBusiness,
} from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function toSortedLatestFirst(a, b) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = await requireSession(req, res, ['owner', 'admin']);
  if (!session) return;

  const queryDryRun = parseBoolean(req.query?.dryRun);
  const bodyDryRun = parseBoolean(req.body?.dryRun);
  const dryRun = req.method === 'GET' || queryDryRun || bodyDryRun;

  const targetBudgetIdFromQuery = typeof req.query?.targetBudgetId === 'string' ? req.query.targetBudgetId : '';
  const targetBudgetIdFromBody = typeof req.body?.targetBudgetId === 'string' ? req.body.targetBudgetId : '';
  const explicitTargetBudgetId = (targetBudgetIdFromBody || targetBudgetIdFromQuery).trim() || null;

  try {
    const [budgets, budgetItems, labourBudgetPlans, labourHoursSalesGoals, revenueSalesGoals] = await Promise.all([
      listBudgetsForBusiness(session.businessId),
      listBudgetItemsForBusiness(session.businessId),
      listLabourBudgetPlansForBusiness(session.businessId),
      listLabourHoursSalesGoalsForBusiness(session.businessId),
      listRevenueSalesGoalsForBusiness(session.businessId),
    ]);

    const unscopedBudgetItems = budgetItems.filter((item) => !item.budgetId);
    const unscopedLabourPlans = labourBudgetPlans.filter((plan) => !plan.budgetId);
    const unscopedLabourHoursGoals = labourHoursSalesGoals.filter((goal) => !goal.budgetId);
    const unscopedRevenueGoals = revenueSalesGoals.filter((goal) => !goal.budgetId);

    const counts = {
      budgetItems: unscopedBudgetItems.length,
      labourBudgetPlans: unscopedLabourPlans.length,
      labourHoursSalesGoals: unscopedLabourHoursGoals.length,
      revenueSalesGoals: unscopedRevenueGoals.length,
    };

    const totalUnscoped = counts.budgetItems
      + counts.labourBudgetPlans
      + counts.labourHoursSalesGoals
      + counts.revenueSalesGoals;

    const sortedBudgets = budgets.slice().sort(toSortedLatestFirst);

    let targetBudget = null;
    if (explicitTargetBudgetId) {
      targetBudget = budgets.find((budget) => budget.id === explicitTargetBudgetId) ?? null;
      if (!targetBudget) {
        return res.status(404).json({ ok: false, error: 'Target budget not found.' });
      }
    } else if (sortedBudgets.length > 0) {
      targetBudget = sortedBudgets[0];
    }

    let createdBudget = null;
    if (!targetBudget) {
      const fiscalYear = String(new Date().getFullYear());
      const createdAt = nowIso();
      const budget = {
        id: generateId(),
        name: `Legacy Company Budget ${fiscalYear}`,
        budgetType: 'operating',
        division: 'company_wide',
        fiscalYear,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      };

      if (!dryRun) {
        await createBudgetForBusiness({ businessId: session.businessId, budget });
      }

      targetBudget = budget;
      createdBudget = budget;
    }

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dryRun: true,
        targetBudget,
        wouldCreateBudget: createdBudget,
        counts,
        totalUnscoped,
      });
    }

    if (totalUnscoped === 0) {
      return res.status(200).json({
        ok: true,
        dryRun: false,
        targetBudget,
        createdBudget,
        counts,
        totalUnscoped,
        migrated: false,
      });
    }

    await Promise.all([
      ...unscopedBudgetItems.map((item) => updateBudgetItemForBusiness({
        businessId: session.businessId,
        budgetItem: { ...item, budgetId: targetBudget.id },
      })),
      ...unscopedLabourPlans.map((plan) => updateLabourBudgetPlanForBusiness({
        businessId: session.businessId,
        labourBudgetPlan: { ...plan, budgetId: targetBudget.id },
      })),
      ...unscopedLabourHoursGoals.map((goal) => updateLabourHoursSalesGoalForBusiness({
        businessId: session.businessId,
        labourHoursSalesGoal: { ...goal, budgetId: targetBudget.id },
      })),
      ...unscopedRevenueGoals.map((goal) => updateRevenueSalesGoalForBusiness({
        businessId: session.businessId,
        revenueSalesGoal: { ...goal, budgetId: targetBudget.id },
      })),
    ]);

    return res.status(200).json({
      ok: true,
      dryRun: false,
      targetBudget,
      createdBudget,
      counts,
      totalUnscoped,
      migrated: true,
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Budget migration failed.' });
  }
}
