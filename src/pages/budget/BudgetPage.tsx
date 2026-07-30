import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Modal, Input, Select, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, FileDown } from 'lucide-react';
import { formatCurrency } from '../../utils';
import type { BudgetItem, BudgetCategory, EmployeeRole, LabourBudgetPlan, LabourCompType } from '../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CATEGORIES: BudgetCategory[] = ['revenue', 'labour', 'materials', 'equipment', 'subcontractors', 'overhead', 'marketing', 'insurance', 'other'];
type BudgetTab = 'analysis' | 'revenue' | 'labour' | 'materials' | 'equipment' | 'subcontractors' | 'overhead';
type ExportColumnMode = 'both' | 'budgeted' | 'actual';
type ExportKind = 'budget' | 'pnl_detailed' | 'pnl_condensed';

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const empty = (): Omit<BudgetItem, 'id'> => ({
  category: 'labour',
  description: '',
  budgeted: 0,
  actual: 0,
  period: currentPeriod(),
});

const yearlyHoursBase = 2080;
const buildLabourPlanId = (employeeId: string, year: string) => `${employeeId}-${year}`;

const defaultLabourPlan = (employeeId: string, year: string, hourlyRate: number): LabourBudgetPlan => ({
  id: buildLabourPlanId(employeeId, year),
  employeeId,
  year,
  compType: 'hourly',
  billableHoursYear: 1600,
  unbillableHoursYear: 300,
  overtimeHoursYear: 0,
  overtimeMultiplier: 1.5,
  hourlyRate,
  annualSalary: Math.round(hourlyRate * yearlyHoursBase),
  labourBurdenPct: 18,
});

export default function BudgetPage() {
  const {
    budgetItems,
    labourBudgetPlans,
    employees,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    upsertLabourBudgetPlan,
  } = useStore();
  const [period, setPeriod] = useState(currentPeriod());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(currentPeriod().slice(0, 4));
  const [activeTab, setActiveTab] = useState<BudgetTab>('revenue');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState(empty());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [assumptionsModalOpen, setAssumptionsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportColumnMode, setExportColumnMode] = useState<ExportColumnMode>('both');
  const [exportKind, setExportKind] = useState<ExportKind>('budget');
  const [pricingInputs, setPricingInputs] = useState({
    payrollBurdenPct: 18,
    overheadRecoveryPct: 15,
    targetMarginPct: 20,
    equipmentUtilizationHours: 120,
    materialWastePct: 8,
    subcontractorRiskPct: 10,
  });

  const allPeriods = [...new Set(budgetItems.map((b) => b.period))].sort().reverse();
  const allYears = [...new Set(budgetItems.map((b) => b.period.slice(0, 4)))].sort().reverse();

  const items = viewMode === 'month'
    ? budgetItems.filter((b) => b.period === period)
    : budgetItems.filter((b) => b.period.startsWith(`${year}-`));
  const scopeLabel = viewMode === 'month' ? period : year;
  const plannerYear = viewMode === 'year' ? year : period.slice(0, 4);

  const openNew = () => {
    const defaultPeriod = viewMode === 'year' ? `${year}-01` : period;
    setEditing(null);
    setForm({ ...empty(), period: defaultPeriod });
    setModalOpen(true);
  };
  const openEdit = (b: BudgetItem) => {
    setEditing(b);
    setForm({ category: b.category, description: b.description, budgeted: b.budgeted, actual: b.actual, period: b.period });
    setModalOpen(true);
  };
  const handleSave = () => {
    if (!form.description.trim()) return;
    if (editing) updateBudgetItem(editing.id, form);
    else addBudgetItem(form);
    setModalOpen(false);
  };
  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const openCategoryEditor = (category: BudgetCategory) => {
    const existingItem = items.find((item) => item.category === category);
    if (existingItem) {
      openEdit(existingItem);
      return;
    }

    const defaultPeriod = viewMode === 'year' ? `${year}-01` : period;
    setEditing(null);
    setForm({ ...empty(), category, period: defaultPeriod });
    setModalOpen(true);
  };

  // Summaries
  const revenue = items.filter((b) => b.category === 'revenue');
  const expenses = items.filter((b) => b.category !== 'revenue');

  const totalBudgetedRevenue = revenue.reduce((s, b) => s + b.budgeted, 0);
  const totalActualRevenue = revenue.reduce((s, b) => s + b.actual, 0);
  const totalBudgetedExpenses = expenses.reduce((s, b) => s + b.budgeted, 0);
  const totalActualExpenses = expenses.reduce((s, b) => s + b.actual, 0);
  const budgetedProfit = totalBudgetedRevenue - totalBudgetedExpenses;
  const actualProfit = totalActualRevenue - totalActualExpenses;

  const grouped = CATEGORIES.reduce<Record<BudgetCategory, BudgetItem[]>>((acc, cat) => {
    acc[cat] = items.filter((b) => b.category === cat);
    return acc;
  }, {} as Record<BudgetCategory, BudgetItem[]>);

  const categoryTabs: Array<{ key: BudgetTab; label: string }> = [
    { key: 'revenue', label: 'Sales / Revenue' },
    { key: 'labour', label: 'Labour' },
    { key: 'materials', label: 'Materials' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'subcontractors', label: 'Subcontractors' },
    { key: 'overhead', label: 'Overhead' },
    { key: 'analysis', label: 'Analysis' },
  ];

  const totalsByCategory = useMemo(() => {
    const sum = (category: BudgetCategory) => ({
      budgeted: grouped[category].reduce((value, item) => value + item.budgeted, 0),
      actual: grouped[category].reduce((value, item) => value + item.actual, 0),
    });

    return {
      revenue: sum('revenue'),
      labour: sum('labour'),
      materials: sum('materials'),
      equipment: sum('equipment'),
      subcontractors: sum('subcontractors'),
      overhead: {
        budgeted: grouped.overhead.reduce((value, item) => value + item.budgeted, 0)
          + grouped.marketing.reduce((value, item) => value + item.budgeted, 0)
          + grouped.insurance.reduce((value, item) => value + item.budgeted, 0)
          + grouped.other.reduce((value, item) => value + item.budgeted, 0),
        actual: grouped.overhead.reduce((value, item) => value + item.actual, 0)
          + grouped.marketing.reduce((value, item) => value + item.actual, 0)
          + grouped.insurance.reduce((value, item) => value + item.actual, 0)
          + grouped.other.reduce((value, item) => value + item.actual, 0),
      },
    };
  }, [grouped]);

  const categoryRows = CATEGORIES.map((category) => {
    const catItems = grouped[category];
    const budgeted = catItems.reduce((sum, item) => sum + item.budgeted, 0);
    const actual = catItems.reduce((sum, item) => sum + item.actual, 0);
    const variance = category === 'revenue' ? actual - budgeted : budgeted - actual;
    return { category, budgeted, actual, variance, count: catItems.length };
  }).filter((row) => row.count > 0);

  const selectedCategory = activeTab !== 'analysis' ? activeTab : null;
  const selectedCategoryItems = selectedCategory ? grouped[selectedCategory] : [];
  const selectedCategoryTotals = selectedCategory
    ? {
        budgeted: selectedCategoryItems.reduce((sum, item) => sum + item.budgeted, 0),
        actual: selectedCategoryItems.reduce((sum, item) => sum + item.actual, 0),
      }
    : { budgeted: 0, actual: 0 };
  const selectedCategoryVariance = selectedCategory
    ? (selectedCategory === 'revenue'
      ? selectedCategoryTotals.actual - selectedCategoryTotals.budgeted
      : selectedCategoryTotals.budgeted - selectedCategoryTotals.actual)
    : 0;

  const tabLabel = categoryTabs.find((tab) => tab.key === activeTab)?.label ?? 'Analysis';

  const directCostCategories: BudgetCategory[] = ['labour', 'materials', 'equipment', 'subcontractors'];
  const operatingExpenseCategories: BudgetCategory[] = ['overhead', 'marketing', 'insurance', 'other'];

  const revenueItems = items.filter((item) => item.category === 'revenue');
  const directCostItems = items.filter((item) => directCostCategories.includes(item.category));
  const operatingExpenseItems = items.filter((item) => operatingExpenseCategories.includes(item.category));

  const budgetedDirectCosts = directCostItems.reduce((sum, item) => sum + item.budgeted, 0);
  const actualDirectCosts = directCostItems.reduce((sum, item) => sum + item.actual, 0);
  const budgetedOperatingExpenses = operatingExpenseItems.reduce((sum, item) => sum + item.budgeted, 0);
  const actualOperatingExpenses = operatingExpenseItems.reduce((sum, item) => sum + item.actual, 0);

  const budgetedGrossProfit = totalBudgetedRevenue - budgetedDirectCosts;
  const actualGrossProfit = totalActualRevenue - actualDirectCosts;
  const budgetedNetProfit = budgetedGrossProfit - budgetedOperatingExpenses;
  const actualNetProfit = actualGrossProfit - actualOperatingExpenses;

  const budgetedGrossMarginPct = totalBudgetedRevenue > 0 ? (budgetedGrossProfit / totalBudgetedRevenue) * 100 : 0;
  const actualGrossMarginPct = totalActualRevenue > 0 ? (actualGrossProfit / totalActualRevenue) * 100 : 0;
  const budgetedNetMarginPct = totalBudgetedRevenue > 0 ? (budgetedNetProfit / totalBudgetedRevenue) * 100 : 0;
  const actualNetMarginPct = totalActualRevenue > 0 ? (actualNetProfit / totalActualRevenue) * 100 : 0;

  const exportMetricHeaders = (mode: ExportColumnMode, includeVariance = true) => {
    if (mode === 'budgeted') return ['Budgeted'];
    if (mode === 'actual') return ['Actual'];
    return includeVariance ? ['Budgeted', 'Actual', 'Variance'] : ['Budgeted', 'Actual'];
  };

  const formatVariance = (value: number) => `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;

  const exportMetricCells = (mode: ExportColumnMode, budgeted: number, actual: number, variance: number, includeVariance = true) => {
    if (mode === 'budgeted') return [formatCurrency(budgeted)];
    if (mode === 'actual') return [formatCurrency(actual)];
    return includeVariance
      ? [formatCurrency(budgeted), formatCurrency(actual), formatVariance(variance)]
      : [formatCurrency(budgeted), formatCurrency(actual)];
  };

  const exportMarginCells = (mode: ExportColumnMode, budgetedPct: number, actualPct: number) => {
    if (mode === 'budgeted') return [`${budgetedPct.toFixed(1)}%`];
    if (mode === 'actual') return [`${actualPct.toFixed(1)}%`];
    return [`${budgetedPct.toFixed(1)}%`, `${actualPct.toFixed(1)}%`];
  };

  const openExportModal = (kind: ExportKind) => {
    setExportKind(kind);
    setExportModalOpen(true);
  };

  const runExport = () => {
    if (exportKind === 'budget') exportToPdf(exportColumnMode);
    else if (exportKind === 'pnl_condensed') exportProfitAndLossPdf(true, exportColumnMode);
    else exportProfitAndLossPdf(false, exportColumnMode);
    setExportModalOpen(false);
  };

  const plansByEmployeeId = useMemo(() => {
    const byEmployeeId: Record<string, LabourBudgetPlan> = {};
    for (const plan of labourBudgetPlans) {
      if (plan.year === plannerYear) {
        byEmployeeId[plan.employeeId] = plan;
      }
    }
    return byEmployeeId;
  }, [labourBudgetPlans, plannerYear]);

  useEffect(() => {
    for (const employee of employees.filter((value) => value.active)) {
      if (plansByEmployeeId[employee.id]) continue;
      upsertLabourBudgetPlan(defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate));
    }
  }, [employees, plannerYear, plansByEmployeeId, upsertLabourBudgetPlan]);

  const exportToPdf = (mode: ExportColumnMode = 'both') => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const scopeTypeLabel = viewMode === 'month' ? 'Monthly' : 'Yearly';
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text('OliveOps Budget Report', 40, 42);
    doc.setFontSize(10);
    doc.text(`Scope: ${scopeTypeLabel} (${scopeLabel})`, 40, 60);
    doc.text(`Tab: ${tabLabel}`, 40, 74);
    doc.text(`Generated: ${generatedAt}`, 40, 88);

    if (activeTab === 'analysis') {
      autoTable(doc, {
        startY: 104,
        head: [['Summary', ...exportMetricHeaders(mode)]],
        body: [
          ['Revenue', ...exportMetricCells(mode, totalBudgetedRevenue, totalActualRevenue, totalActualRevenue - totalBudgetedRevenue)],
          ['Expenses', ...exportMetricCells(mode, totalBudgetedExpenses, totalActualExpenses, totalBudgetedExpenses - totalActualExpenses)],
          ['Profit', ...exportMetricCells(mode, budgetedProfit, actualProfit, actualProfit - budgetedProfit)],
        ],
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 220,
        head: [['Category', ...exportMetricHeaders(mode), 'Items']],
        body: categoryRows.map((row) => [
          row.category.replace(/_/g, ' '),
          ...exportMetricCells(mode, row.budgeted, row.actual, row.variance),
          String(row.count),
        ]),
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 390,
        head: [[
          ...(viewMode === 'year' ? ['Period'] : []),
          'Category',
          'Description',
          ...exportMetricHeaders(mode),
        ]],
        body: items.map((item) => {
          const variance = item.category === 'revenue' ? item.actual - item.budgeted : item.budgeted - item.actual;
          return [
            ...(viewMode === 'year' ? [item.period] : []),
            item.category.replace(/_/g, ' '),
            item.description,
            ...exportMetricCells(mode, item.budgeted, item.actual, variance),
          ];
        }),
        styles: { fontSize: 8 },
      });
    } else {
      autoTable(doc, {
        startY: 104,
        head: [['Category Totals', ...exportMetricHeaders(mode)]],
        body: [[
          tabLabel,
          ...exportMetricCells(mode, selectedCategoryTotals.budgeted, selectedCategoryTotals.actual, selectedCategoryVariance),
        ]],
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 170,
        head: [[
          ...(viewMode === 'year' ? ['Period'] : []),
          'Description',
          ...exportMetricHeaders(mode),
        ]],
        body: selectedCategoryItems.map((item) => {
          const variance = item.category === 'revenue' ? item.actual - item.budgeted : item.budgeted - item.actual;
          return [
            ...(viewMode === 'year' ? [item.period] : []),
            item.description,
            ...exportMetricCells(mode, item.budgeted, item.actual, variance),
          ];
        }),
        styles: { fontSize: 9 },
      });
    }

    doc.save(`budget-${activeTab}-${scopeLabel}-${mode}.pdf`);
  };

  const exportProfitAndLossPdf = (condensed = false, mode: ExportColumnMode = 'both') => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const scopeTypeLabel = viewMode === 'month' ? 'Monthly' : 'Yearly';
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text(`OliveOps Profit & Loss Statement${condensed ? ' (1-Page)' : ''}`, 40, 42);
    doc.setFontSize(10);
    doc.text(`Scope: ${scopeTypeLabel} (${scopeLabel})`, 40, 60);
    doc.text(`Generated: ${generatedAt}`, 40, 74);

    autoTable(doc, {
      startY: 92,
      head: [['P&L Summary', ...exportMetricHeaders(mode)]],
      body: [
        ['Revenue', ...exportMetricCells(mode, totalBudgetedRevenue, totalActualRevenue, totalActualRevenue - totalBudgetedRevenue)],
        ['Direct Costs (Labour + Materials + Equipment + Subcontractors)', ...exportMetricCells(mode, budgetedDirectCosts, actualDirectCosts, budgetedDirectCosts - actualDirectCosts)],
        ['Gross Profit', ...exportMetricCells(mode, budgetedGrossProfit, actualGrossProfit, actualGrossProfit - budgetedGrossProfit)],
        ['Operating Expenses', ...exportMetricCells(mode, budgetedOperatingExpenses, actualOperatingExpenses, budgetedOperatingExpenses - actualOperatingExpenses)],
        ['Net Profit', ...exportMetricCells(mode, budgetedNetProfit, actualNetProfit, actualNetProfit - budgetedNetProfit)],
      ],
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: 232,
      head: [['Margin Analysis', ...exportMetricHeaders(mode, false)]],
      body: [
        ['Gross Margin %', ...exportMarginCells(mode, budgetedGrossMarginPct, actualGrossMarginPct)],
        ['Net Margin %', ...exportMarginCells(mode, budgetedNetMarginPct, actualNetMarginPct)],
      ],
      styles: { fontSize: 9 },
    });

    if (condensed) {
      autoTable(doc, {
        startY: 314,
        head: [['Cost Category Snapshot', ...exportMetricHeaders(mode)]],
        body: [
          ['Labour', ...exportMetricCells(mode, grouped.labour.reduce((sum, item) => sum + item.budgeted, 0), grouped.labour.reduce((sum, item) => sum + item.actual, 0), grouped.labour.reduce((sum, item) => sum + item.budgeted - item.actual, 0))],
          ['Materials', ...exportMetricCells(mode, grouped.materials.reduce((sum, item) => sum + item.budgeted, 0), grouped.materials.reduce((sum, item) => sum + item.actual, 0), grouped.materials.reduce((sum, item) => sum + item.budgeted - item.actual, 0))],
          ['Equipment', ...exportMetricCells(mode, grouped.equipment.reduce((sum, item) => sum + item.budgeted, 0), grouped.equipment.reduce((sum, item) => sum + item.actual, 0), grouped.equipment.reduce((sum, item) => sum + item.budgeted - item.actual, 0))],
          ['Subcontractors', ...exportMetricCells(mode, grouped.subcontractors.reduce((sum, item) => sum + item.budgeted, 0), grouped.subcontractors.reduce((sum, item) => sum + item.actual, 0), grouped.subcontractors.reduce((sum, item) => sum + item.budgeted - item.actual, 0))],
          ['Overhead', ...exportMetricCells(mode, grouped.overhead.reduce((sum, item) => sum + item.budgeted, 0), grouped.overhead.reduce((sum, item) => sum + item.actual, 0), grouped.overhead.reduce((sum, item) => sum + item.budgeted - item.actual, 0))],
        ],
        styles: { fontSize: 9 },
      });

      doc.save(`profit-loss-${scopeTypeLabel.toLowerCase()}-${scopeLabel}-1-page-${mode}.pdf`);
      return;
    }

    autoTable(doc, {
      startY: 314,
      head: [[...(viewMode === 'year' ? ['Period'] : []), 'Revenue Description', ...exportMetricHeaders(mode, false)]],
      body: revenueItems.map((item) => [
        ...(viewMode === 'year' ? [item.period] : []),
        item.description,
        ...exportMetricCells(mode, item.budgeted, item.actual, 0, false),
      ]),
      styles: { fontSize: 8 },
    });

    const cogsStartY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 314) + 16
      : 430;

    autoTable(doc, {
      startY: cogsStartY,
      head: [[...(viewMode === 'year' ? ['Period'] : []), 'Direct Cost Description', 'Category', ...exportMetricHeaders(mode, false)]],
      body: directCostItems.map((item) => [
        ...(viewMode === 'year' ? [item.period] : []),
        item.description,
        item.category.replace(/_/g, ' '),
        ...exportMetricCells(mode, item.budgeted, item.actual, 0, false),
      ]),
      styles: { fontSize: 8 },
    });

    const opexStartY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cogsStartY) + 16
      : cogsStartY + 120;

    autoTable(doc, {
      startY: opexStartY,
      head: [[...(viewMode === 'year' ? ['Period'] : []), 'Operating Expense Description', 'Category', ...exportMetricHeaders(mode, false)]],
      body: operatingExpenseItems.map((item) => [
        ...(viewMode === 'year' ? [item.period] : []),
        item.description,
        item.category.replace(/_/g, ' '),
        ...exportMetricCells(mode, item.budgeted, item.actual, 0, false),
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`profit-loss-${scopeTypeLabel.toLowerCase()}-${scopeLabel}-${mode}.pdf`);
  };

  const updatePricingInput = (key: keyof typeof pricingInputs, value: number) => {
    const next = Number.isFinite(value) ? value : 0;
    setPricingInputs((current) => ({ ...current, [key]: Math.max(0, next) }));
  };

  const marginDivisor = Math.max(0.01, 1 - pricingInputs.targetMarginPct / 100);
  const activeEmployees = employees.filter((employee) => employee.active);
  const averageBaseLaborRate =
    activeEmployees.length > 0
      ? activeEmployees.reduce((sum, employee) => sum + employee.hourlyRate, 0) / activeEmployees.length
      : 0;

  const loadedLaborCostPerHour = averageBaseLaborRate * (1 + pricingInputs.payrollBurdenPct / 100);
  const laborBreakEvenRate = loadedLaborCostPerHour * (1 + pricingInputs.overheadRecoveryPct / 100);
  const suggestedLaborSellRate = laborBreakEvenRate / marginDivisor;

  const periodEquipmentActual = items
    .filter((item) => item.category === 'equipment')
    .reduce((sum, item) => sum + item.actual, 0);
  const machineBaseCostPerHour =
    pricingInputs.equipmentUtilizationHours > 0
      ? periodEquipmentActual / pricingInputs.equipmentUtilizationHours
      : 0;
  const machineBreakEvenRate = machineBaseCostPerHour * (1 + pricingInputs.overheadRecoveryPct / 100);
  const suggestedMachineSellRate = machineBreakEvenRate / marginDivisor;

  const materialSellMultiplier =
    (1 + pricingInputs.materialWastePct / 100) * (1 + pricingInputs.overheadRecoveryPct / 100) / marginDivisor;
  const suggestedMaterialMarkupPct = (materialSellMultiplier - 1) * 100;

  const subcontractorSellMultiplier =
    (1 + pricingInputs.subcontractorRiskPct / 100) * (1 + pricingInputs.overheadRecoveryPct / 100) / marginDivisor;
  const suggestedSubcontractorMarkupPct = (subcontractorSellMultiplier - 1) * 100;

  const roleBenchmarks = useMemo(() => {
    const groups = new Map<EmployeeRole, { count: number; totalRate: number }>();
    for (const employee of activeEmployees) {
      const existing = groups.get(employee.role) ?? { count: 0, totalRate: 0 };
      existing.count += 1;
      existing.totalRate += employee.hourlyRate;
      groups.set(employee.role, existing);
    }

    return Array.from(groups.entries()).map(([role, data]) => {
      const averageRate = data.totalRate / Math.max(1, data.count);
      const loadedCost = averageRate * (1 + pricingInputs.payrollBurdenPct / 100);
      const breakEven = loadedCost * (1 + pricingInputs.overheadRecoveryPct / 100);
      const suggestedSellRate = breakEven / marginDivisor;

      return {
        role,
        count: data.count,
        averageRate,
        loadedCost,
        suggestedSellRate,
      };
    }).sort((a, b) => a.role.localeCompare(b.role));
  }, [activeEmployees, marginDivisor, pricingInputs.overheadRecoveryPct, pricingInputs.payrollBurdenPct]);

  const updateLabourPlan = (employeeId: string, key: keyof LabourBudgetPlan, value: number | LabourCompType) => {
    const employee = activeEmployees.find((value) => value.id === employeeId);
    if (!employee) return;

    const existing = plansByEmployeeId[employeeId] ?? defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate);
    const next = { ...existing, [key]: value };
    upsertLabourBudgetPlan(next);
  };

  const labourPlannerRows = useMemo(() => {
    return activeEmployees.map((employee) => {
      const plan = plansByEmployeeId[employee.id] ?? defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate);

      const baseHourlyRate = plan.compType === 'hourly'
        ? plan.hourlyRate
        : (plan.annualSalary / yearlyHoursBase);
      const regularHours = plan.billableHoursYear + plan.unbillableHoursYear;
      const regularCompensation = plan.compType === 'hourly'
        ? regularHours * baseHourlyRate
        : plan.annualSalary;
      const overtimeCompensation = plan.compType === 'hourly'
        ? plan.overtimeHoursYear * baseHourlyRate * plan.overtimeMultiplier
        : plan.overtimeHoursYear * baseHourlyRate * Math.max(plan.overtimeMultiplier - 1, 0);
      const totalCompensation = regularCompensation + overtimeCompensation;
      const labourBurdenAmount = totalCompensation * (plan.labourBurdenPct / 100);
      const totalLabourCost = totalCompensation + labourBurdenAmount;

      return {
        employee,
        plan,
        baseHourlyRate,
        totalCompensation,
        labourBurdenAmount,
        totalLabourCost,
      };
    });
  }, [activeEmployees, plannerYear, plansByEmployeeId]);

  const labourPlannerTotals = useMemo(() => {
    return labourPlannerRows.reduce((acc, row) => ({
      totalCompensation: acc.totalCompensation + row.totalCompensation,
      labourBurdenAmount: acc.labourBurdenAmount + row.labourBurdenAmount,
      totalLabourCost: acc.totalLabourCost + row.totalLabourCost,
      billableHoursYear: acc.billableHoursYear + row.plan.billableHoursYear,
      unbillableHoursYear: acc.unbillableHoursYear + row.plan.unbillableHoursYear,
      overtimeHoursYear: acc.overtimeHoursYear + row.plan.overtimeHoursYear,
    }), {
      totalCompensation: 0,
      labourBurdenAmount: 0,
      totalLabourCost: 0,
      billableHoursYear: 0,
      unbillableHoursYear: 0,
      overtimeHoursYear: 0,
    });
  }, [labourPlannerRows]);

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle="Track your company budget by month or year, with category breakdowns for pricing and planning."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openExportModal('pnl_condensed')}><FileDown size={16} /> Export P&L 1-Page</Button>
            <Button variant="secondary" onClick={() => openExportModal('pnl_detailed')}><FileDown size={16} /> Export P&L PDF</Button>
            <Button variant="secondary" onClick={() => openExportModal('budget')}><FileDown size={16} /> Export PDF</Button>
            <Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>
          </div>
        }
      />

      {/* Scope selector */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={viewMode === 'month' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('month')}>Monthly</Button>
          <Button variant={viewMode === 'year' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('year')}>Yearly</Button>
          <span className="text-xs text-gray-500">Current scope: {scopeLabel}</span>
        </div>
        {viewMode === 'month' ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {allPeriods.filter((p) => p !== period).length > 0 && (
              <select onChange={(e) => setPeriod(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-500">
                <option value="">Jump to period…</option>
                {allPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-32"
            />
            {allYears.length > 0 && (
              <select value={year} onChange={(e) => setYear(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-500">
                {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="inline-flex border border-gray-200 rounded-xl p-1 bg-white min-w-max" role="tablist" aria-label="Budget sections">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'analysis' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalBudgetedRevenue)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Actual Revenue</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(totalActualRevenue)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budget vs Actual Profit</p>
                <p className={`text-xl font-bold ${budgetedProfit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(budgetedProfit)}</p>
                <p className={`text-xs ${actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Actual: {formatCurrency(actualProfit)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('overhead')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalActualExpenses)}</p>
                <p className="text-xs text-gray-400">Budget: {formatCurrency(totalBudgetedExpenses)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
          </div>

          <Card className="p-4 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Estimate Pricing Calculator</h2>
              <p className="text-sm text-gray-500 mt-1">Use current budget + payroll assumptions to set charge-out rates for labour, machine time, materials, and subcontractors.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
              <Input
                label="Payroll Burden (%)"
                type="number"
                min={0}
                value={pricingInputs.payrollBurdenPct}
                onChange={(e) => updatePricingInput('payrollBurdenPct', Number(e.target.value))}
              />
              <Input
                label="Overhead Recovery (%)"
                type="number"
                min={0}
                value={pricingInputs.overheadRecoveryPct}
                onChange={(e) => updatePricingInput('overheadRecoveryPct', Number(e.target.value))}
              />
              <Input
                label="Target Margin (%)"
                type="number"
                min={0}
                max={95}
                value={pricingInputs.targetMarginPct}
                onChange={(e) => updatePricingInput('targetMarginPct', Number(e.target.value))}
              />
              <Input
                label="Machine Utilization (hrs/month)"
                type="number"
                min={1}
                value={pricingInputs.equipmentUtilizationHours}
                onChange={(e) => updatePricingInput('equipmentUtilizationHours', Number(e.target.value))}
              />
              <Input
                label="Material Waste Buffer (%)"
                type="number"
                min={0}
                value={pricingInputs.materialWastePct}
                onChange={(e) => updatePricingInput('materialWastePct', Number(e.target.value))}
              />
              <Input
                label="Subcontractor Risk Buffer (%)"
                type="number"
                min={0}
                value={pricingInputs.subcontractorRiskPct}
                onChange={(e) => updatePricingInput('subcontractorRiskPct', Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
                <Card className="p-4 hover:border-brand-300 cursor-pointer">
                  <p className="text-xs text-gray-500">Suggested Labour Charge-Out</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(suggestedLaborSellRate)}/hr</p>
                  <p className="text-xs text-gray-400 mt-1">Avg pay {formatCurrency(averageBaseLaborRate)}/hr, loaded {formatCurrency(loadedLaborCostPerHour)}/hr</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
                </Card>
              </button>
              <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
                <Card className="p-4 hover:border-brand-300 cursor-pointer">
                  <p className="text-xs text-gray-500">Suggested Machine Charge-Out</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(suggestedMachineSellRate)}/hr</p>
                  <p className="text-xs text-gray-400 mt-1">Based on equipment actual {formatCurrency(periodEquipmentActual)} for {scopeLabel}</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
                </Card>
              </button>
              <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
                <Card className="p-4 hover:border-brand-300 cursor-pointer">
                  <p className="text-xs text-gray-500">Material Markup Guidance</p>
                  <p className="text-xl font-bold text-gray-900">{suggestedMaterialMarkupPct.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400 mt-1">Includes waste + overhead + target margin</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
                </Card>
              </button>
              <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
                <Card className="p-4 hover:border-brand-300 cursor-pointer">
                  <p className="text-xs text-gray-500">Subcontractor Markup Guidance</p>
                  <p className="text-xl font-bold text-gray-900">{suggestedSubcontractorMarkupPct.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400 mt-1">Includes risk buffer + overhead + target margin</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
                </Card>
              </button>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'labour' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <button type="button" onClick={() => openCategoryEditor('labour')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Labour</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.labour.budgeted)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('labour')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Actual Labour</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.labour.actual)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Suggested Labour Rate</p>
                <p className="text-xl font-bold text-brand-700">{formatCurrency(suggestedLaborSellRate)}/hr</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
          </div>

          <Card className="overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Employee Labour Budget Planner</h2>
              <p className="text-sm text-gray-500 mt-1">Set each employee as hourly or salaried, then plan annual billable/unbillable/overtime hours with labour burden.</p>
            </div>
            {labourPlannerRows.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">No active employees yet. Add employees first to build labour budgets.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Comp Type</th>
                      <th className="px-4 py-3 font-medium text-right">Pay Basis</th>
                      <th className="px-4 py-3 font-medium text-right">Billable Hrs / Yr</th>
                      <th className="px-4 py-3 font-medium text-right">Unbillable Hrs / Yr</th>
                      <th className="px-4 py-3 font-medium text-right">Overtime Hrs / Yr</th>
                      <th className="px-4 py-3 font-medium text-right">Overtime Multiplier</th>
                      <th className="px-4 py-3 font-medium text-right">Total Compensation</th>
                      <th className="px-4 py-3 font-medium text-right">Labour Burden (%)</th>
                      <th className="px-4 py-3 font-medium text-right">Labour Burden ($)</th>
                      <th className="px-4 py-3 font-medium text-right">Total Labour Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {labourPlannerRows.map((row) => (
                      <tr key={row.employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-900">{row.employee.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{row.employee.role.replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-4 py-2">
                          <div className="inline-flex border border-gray-200 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateLabourPlan(row.employee.id, 'compType', 'hourly')}
                              className={`px-2 py-1 text-xs rounded ${row.plan.compType === 'hourly' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Hourly
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLabourPlan(row.employee.id, 'compType', 'salaried')}
                              className={`px-2 py-1 text-xs rounded ${row.plan.compType === 'salaried' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Salaried
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {row.plan.compType === 'hourly' ? (
                            <input
                              type="number"
                              min={0}
                              value={row.plan.hourlyRate}
                              onChange={(e) => updateLabourPlan(row.employee.id, 'hourlyRate', Number(e.target.value))}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                            />
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={row.plan.annualSalary}
                              onChange={(e) => updateLabourPlan(row.employee.id, 'annualSalary', Number(e.target.value))}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.plan.billableHoursYear}
                            onChange={(e) => updateLabourPlan(row.employee.id, 'billableHoursYear', Number(e.target.value))}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.plan.unbillableHoursYear}
                            onChange={(e) => updateLabourPlan(row.employee.id, 'unbillableHoursYear', Number(e.target.value))}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.plan.overtimeHoursYear}
                            onChange={(e) => updateLabourPlan(row.employee.id, 'overtimeHoursYear', Number(e.target.value))}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            step={0.1}
                            value={row.plan.overtimeMultiplier}
                            onChange={(e) => updateLabourPlan(row.employee.id, 'overtimeMultiplier', Number(e.target.value))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.totalCompensation)}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={row.plan.labourBurdenPct}
                            onChange={(e) => updateLabourPlan(row.employee.id, 'labourBurdenPct', Number(e.target.value))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.labourBurdenAmount)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-700">{formatCurrency(row.totalLabourCost)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 font-semibold" colSpan={3}>Totals</td>
                      <td className="px-4 py-2 text-right font-semibold">{labourPlannerTotals.billableHoursYear.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{labourPlannerTotals.unbillableHoursYear.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{labourPlannerTotals.overtimeHoursYear.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right">—</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(labourPlannerTotals.totalCompensation)}</td>
                      <td className="px-4 py-2 text-right">—</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(labourPlannerTotals.labourBurdenAmount)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-brand-700">{formatCurrency(labourPlannerTotals.totalLabourCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Role-Based Labour Benchmarks</h2>
              <p className="text-sm text-gray-500 mt-1">Labour rates by role using current payroll and margin assumptions.</p>
            </div>
            {roleBenchmarks.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">No active employees yet. Add employees with hourly rates to calculate labour benchmarks.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium text-right">Team Size</th>
                      <th className="px-4 py-3 font-medium text-right">Avg Pay / Hr</th>
                      <th className="px-4 py-3 font-medium text-right">Loaded Cost / Hr</th>
                      <th className="px-4 py-3 font-medium text-right">Suggested Bill Rate / Hr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {roleBenchmarks.map((row) => (
                      <tr key={row.role} className="hover:bg-gray-50">
                        <td className="px-4 py-2 capitalize">{row.role.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-right">{row.count}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.averageRate)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.loadedCost)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-700">{formatCurrency(row.suggestedSellRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'revenue' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Sales / Revenue</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalsByCategory.revenue.budgeted)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Actual Sales / Revenue</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalsByCategory.revenue.actual)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Revenue Variance</p>
              <p className={`text-xl font-bold ${(totalsByCategory.revenue.actual - totalsByCategory.revenue.budgeted) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {(totalsByCategory.revenue.actual - totalsByCategory.revenue.budgeted) >= 0 ? '+' : ''}{formatCurrency(totalsByCategory.revenue.actual - totalsByCategory.revenue.budgeted)}
              </p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('materials')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Materials</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.materials.budgeted)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('materials')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Actual Materials</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.materials.actual)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Suggested Material Markup</p>
              <p className="text-xl font-bold text-brand-700">{suggestedMaterialMarkupPct.toFixed(1)}%</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Equipment</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.equipment.budgeted)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Actual Equipment</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.equipment.actual)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Suggested Machine Charge-Out</p>
              <p className="text-xl font-bold text-brand-700">{formatCurrency(suggestedMachineSellRate)}/hr</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
        </div>
      )}

      {activeTab === 'subcontractors' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('subcontractors')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.subcontractors.budgeted)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('subcontractors')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Actual Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.subcontractors.actual)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Suggested Subcontractor Markup</p>
              <p className="text-xl font-bold text-brand-700">{suggestedSubcontractorMarkupPct.toFixed(1)}%</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
        </div>
      )}

      {activeTab === 'overhead' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('overhead')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Overhead</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.overhead.budgeted)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => openCategoryEditor('overhead')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Actual Overhead</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.overhead.actual)}</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
          <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Overhead Recovery Setting</p>
              <p className="text-xl font-bold text-brand-700">{pricingInputs.overheadRecoveryPct.toFixed(1)}%</p>
            <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
            </Card>
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title={`No budget items for ${scopeLabel}`} action={<Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>} />
      ) : activeTab === 'analysis' ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Category Analysis ({scopeLabel})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                  <th className="px-4 py-3 font-medium text-right">Actual</th>
                  <th className="px-4 py-3 font-medium text-right">Variance</th>
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categoryRows.map((row) => (
                  <tr key={row.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2 capitalize">{row.category}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.budgeted)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.actual)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.variance >= 0 ? '+' : ''}{formatCurrency(row.variance)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Budget Items ({scopeLabel})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Category</th>
                  {viewMode === 'year' && <th className="px-4 py-3 font-medium">Period</th>}
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                  <th className="px-4 py-3 font-medium text-right">Actual</th>
                  <th className="px-4 py-3 font-medium text-right">Variance</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((b) => {
                  const variance = b.category === 'revenue' ? b.actual - b.budgeted : b.budgeted - b.actual;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 capitalize">{b.category}</td>
                      {viewMode === 'year' && <td className="px-4 py-2 text-gray-500">{b.period}</td>}
                      <td className="px-4 py-2 text-gray-700">{b.description}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(b.budgeted)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(b.actual)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Pencil size={13} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b.id)}><Trash2 size={13} className="text-red-400" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-xs text-gray-500">Budgeted {activeTab}</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedCategoryTotals.budgeted)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Actual {activeTab}</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedCategoryTotals.actual)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Variance</p>
              <p className={`text-xl font-bold ${selectedCategoryVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedCategoryVariance >= 0 ? '+' : ''}{formatCurrency(selectedCategoryVariance)}
              </p>
            </Card>
          </div>

          {selectedCategoryItems.length === 0 ? (
            <EmptyState title={`No ${activeTab} items for ${scopeLabel}`} action={<Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>} />
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                    {viewMode === 'year' && <th className="px-4 py-3 font-medium">Period</th>}
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                    <th className="px-4 py-3 font-medium text-right">Actual</th>
                    <th className="px-4 py-3 font-medium text-right">Variance</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedCategoryItems.map((b) => {
                    const variance = b.category === 'revenue' ? b.actual - b.budgeted : b.budgeted - b.actual;
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        {viewMode === 'year' && <td className="px-4 py-2 text-gray-500">{b.period}</td>}
                        <td className="px-4 py-2 text-gray-700">{b.description}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(b.budgeted)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(b.actual)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Pencil size={13} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b.id)}><Trash2 size={13} className="text-red-400" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Budget Item' : 'New Budget Item'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value as BudgetCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </Select>
            <Input label="Period (YYYY-MM)" value={form.period} onChange={(e) => set('period', e.target.value)} />
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Budgeted ($)" type="number" min={0} value={form.budgeted} onChange={(e) => set('budgeted', Number(e.target.value))} />
            <Input label="Actual ($)" type="number" min={0} value={form.actual} onChange={(e) => set('actual', Number(e.target.value))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Budget Item"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteBudgetItem(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
        </>}
      >
        <p className="text-gray-600">Delete this budget item?</p>
      </Modal>

      <Modal
        open={assumptionsModalOpen}
        onClose={() => setAssumptionsModalOpen(false)}
        title="Edit Pricing Assumptions"
        footer={<>
          <Button variant="secondary" onClick={() => setAssumptionsModalOpen(false)}>Close</Button>
        </>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payroll Burden (%)"
            type="number"
            min={0}
            value={pricingInputs.payrollBurdenPct}
            onChange={(e) => updatePricingInput('payrollBurdenPct', Number(e.target.value))}
          />
          <Input
            label="Overhead Recovery (%)"
            type="number"
            min={0}
            value={pricingInputs.overheadRecoveryPct}
            onChange={(e) => updatePricingInput('overheadRecoveryPct', Number(e.target.value))}
          />
          <Input
            label="Target Margin (%)"
            type="number"
            min={0}
            max={95}
            value={pricingInputs.targetMarginPct}
            onChange={(e) => updatePricingInput('targetMarginPct', Number(e.target.value))}
          />
          <Input
            label="Machine Utilization (hrs/month)"
            type="number"
            min={1}
            value={pricingInputs.equipmentUtilizationHours}
            onChange={(e) => updatePricingInput('equipmentUtilizationHours', Number(e.target.value))}
          />
          <Input
            label="Material Waste Buffer (%)"
            type="number"
            min={0}
            value={pricingInputs.materialWastePct}
            onChange={(e) => updatePricingInput('materialWastePct', Number(e.target.value))}
          />
          <Input
            label="Subcontractor Risk Buffer (%)"
            type="number"
            min={0}
            value={pricingInputs.subcontractorRiskPct}
            onChange={(e) => updatePricingInput('subcontractorRiskPct', Number(e.target.value))}
          />
        </div>
      </Modal>

      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export PDF Options"
        footer={<>
          <Button variant="secondary" onClick={() => setExportModalOpen(false)}>Cancel</Button>
          <Button onClick={runExport}>Export</Button>
        </>}
      >
        <div className="space-y-4">
          <Input
            label="Report"
            value={
              exportKind === 'budget'
                ? 'Budget Report'
                : exportKind === 'pnl_condensed'
                  ? 'Profit & Loss (1-Page)'
                  : 'Profit & Loss (Detailed)'
            }
            disabled
          />
          <Select
            label="Columns"
            value={exportColumnMode}
            onChange={(e) => setExportColumnMode(e.target.value as ExportColumnMode)}
          >
            <option value="both">Budgeted + Actual + Variance</option>
            <option value="budgeted">Budgeted only</option>
            <option value="actual">Actual only</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}



