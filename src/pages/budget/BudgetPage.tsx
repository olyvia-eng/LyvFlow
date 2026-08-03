import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Modal, Input, Select, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, FileDown, Info, Users, Target, BadgeDollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { formatNumericDisplayValue, parseNumericInputValue } from '../../utils/numberInput';
import type { BudgetItem, BudgetCategory, LabourBudgetPlan, LabourCompType, EquipmentCostType, RevenueSalesGoal } from '../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CATEGORIES: BudgetCategory[] = ['revenue', 'labour', 'materials', 'equipment', 'subcontractors', 'overhead', 'marketing', 'insurance', 'other'];
type BudgetTab = 'analysis' | 'revenue' | 'labour' | 'materials' | 'equipment' | 'subcontractors' | 'overhead';
type ExportColumnMode = 'budgeted';
type ExportKind = 'budget' | 'pnl_detailed' | 'pnl_condensed';
type LabourTableView = 'all' | LabourCompType;
type EquipmentTableView = 'all' | EquipmentCostType;

const EQUIPMENT_COST_TYPES: EquipmentCostType[] = ['financed', 'leased', 'other'];

const CATEGORY_BY_TAB: Record<Exclude<BudgetTab, 'analysis'>, BudgetCategory> = {
  revenue: 'revenue',
  labour: 'labour',
  materials: 'materials',
  equipment: 'equipment',
  subcontractors: 'subcontractors',
  overhead: 'overhead',
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const compareBudgetItemsByCostCode = (a: BudgetItem, b: BudgetItem) => {
  const aCode = a.costCode?.trim() ?? '';
  const bCode = b.costCode?.trim() ?? '';

  if (!aCode && !bCode) {
    return a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
  }
  if (!aCode) return 1;
  if (!bCode) return -1;

  const byCode = aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: 'base' });
  if (byCode !== 0) return byCode;

  return a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
};

const empty = (): Omit<BudgetItem, 'id'> => ({
  category: 'labour',
  equipmentCostType: undefined,
  costCode: '',
  equipmentPayment: undefined,
  equipmentPaymentFrequencyPerYear: undefined,
  fuelPriceUnit: undefined,
  averageFuelPrice: undefined,
  averageFuelBurnPerHour: undefined,
  fuelCostPerHour: undefined,
  monthlyInsuranceCost: undefined,
  monthlyMaintenanceCost: undefined,
  sellableHoursPerYear: undefined,
  actualMachineHoursPerYear: undefined,
  description: '',
  budgeted: 0,
  actual: 0,
  period: currentPeriod(),
});

const equipmentInfoDefaults = () => ({
  equipmentPayment: 0,
  equipmentPaymentFrequencyPerYear: 12,
  fuelPriceUnit: 'L' as const,
  averageFuelPrice: 0,
  averageFuelBurnPerHour: 0,
  fuelCostPerHour: 0,
  monthlyInsuranceCost: 0,
  monthlyMaintenanceCost: 0,
  sellableHoursPerYear: 0,
  actualMachineHoursPerYear: 0,
});

const yearlyHoursBase = 2080;
const buildLabourPlanId = (employeeId: string, year: string) => `${employeeId}-${year}`;
const buildRevenueSalesGoalId = (scopeType: 'year', scopeValue: string) => `revenue-goal-${scopeType}-${scopeValue}`;
const DEFAULT_WORKING_DAYS_YEAR = 260;

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
    revenueSalesGoals,
    employees,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    upsertLabourBudgetPlan,
    upsertRevenueSalesGoal,
  } = useStore();
  const [year, setYear] = useState(currentPeriod().slice(0, 4));
  const [activeTab, setActiveTab] = useState<BudgetTab>('revenue');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState(empty());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [assumptionsModalOpen, setAssumptionsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportColumnMode, setExportColumnMode] = useState<ExportColumnMode>('budgeted');
  const [exportKind, setExportKind] = useState<ExportKind>('budget');
  const [labourTableView, setLabourTableView] = useState<LabourTableView>('all');
  const [equipmentTableView, setEquipmentTableView] = useState<EquipmentTableView>('all');
  const [showLabourCalcDetails, setShowLabourCalcDetails] = useState(false);
  const [averageFuelPriceInput, setAverageFuelPriceInput] = useState('0');
  const [averageFuelBurnPerHourInput, setAverageFuelBurnPerHourInput] = useState('0');
  const [pricingInputs, setPricingInputs] = useState({
    payrollBurdenPct: 18,
    overheadRecoveryPct: 15,
    targetMarginPct: 20,
    equipmentUtilizationHours: 120,
    materialWastePct: 8,
    subcontractorRiskPct: 10,
  });

  const allYears = [...new Set(budgetItems.map((b) => b.period.slice(0, 4)))].sort().reverse();

  const items = useMemo(() => {
    return budgetItems
      .filter((b) => b.period.startsWith(`${year}-`))
      .sort(compareBudgetItemsByCostCode);
  }, [budgetItems, year]);
  const scopeLabel = year;
  const revenueScopeType: 'year' = 'year';
  const revenueScopeValue = scopeLabel;
  const plannerYear = year;

  const openNew = () => {
    const defaultPeriod = `${year}-01`;
    const defaultCategory = activeTab === 'analysis' ? 'revenue' : CATEGORY_BY_TAB[activeTab];
    const defaultEquipmentInfo = defaultCategory === 'equipment' ? equipmentInfoDefaults() : null;
    setEditing(null);
    setForm({
      ...empty(),
      category: defaultCategory,
      equipmentCostType: defaultCategory === 'equipment' ? 'financed' : undefined,
      ...(defaultEquipmentInfo ?? {}),
      period: defaultPeriod,
    });
    if (defaultEquipmentInfo) {
      setAverageFuelPriceInput(formatNumericDisplayValue(defaultEquipmentInfo.averageFuelPrice));
      setAverageFuelBurnPerHourInput(formatNumericDisplayValue(defaultEquipmentInfo.averageFuelBurnPerHour));
    } else {
      setAverageFuelPriceInput('0');
      setAverageFuelBurnPerHourInput('0');
    }
    setModalOpen(true);
  };
  const openEdit = (b: BudgetItem) => {
    const averageFuelPrice = b.averageFuelPrice ?? b.fuelCostPerHour ?? 0;
    const averageFuelBurnPerHour = b.averageFuelBurnPerHour ?? 1;
    setEditing(b);
    setForm({
      category: b.category,
      equipmentCostType: b.equipmentCostType,
      costCode: b.costCode ?? '',
      equipmentPayment: b.equipmentPayment,
      equipmentPaymentFrequencyPerYear: b.equipmentPaymentFrequencyPerYear,
      fuelPriceUnit: b.fuelPriceUnit ?? 'L',
      averageFuelPrice,
      averageFuelBurnPerHour,
      fuelCostPerHour: b.fuelCostPerHour,
      monthlyInsuranceCost: b.monthlyInsuranceCost,
      monthlyMaintenanceCost: b.monthlyMaintenanceCost,
      sellableHoursPerYear: b.sellableHoursPerYear,
      actualMachineHoursPerYear: b.actualMachineHoursPerYear,
      description: b.description,
      budgeted: b.budgeted,
      actual: b.actual,
      period: b.period,
    });
    setAverageFuelPriceInput(formatNumericDisplayValue(averageFuelPrice));
    setAverageFuelBurnPerHourInput(formatNumericDisplayValue(averageFuelBurnPerHour));
    setModalOpen(true);
  };
  const handleSave = () => {
    if (!form.description.trim()) return;
    const normalizedCostCode = form.costCode?.trim();
    const normalizeNumber = (value: number | undefined) => Math.max(0, Number.isFinite(value ?? 0) ? (value ?? 0) : 0);
    const normalizedFuelPriceUnit: BudgetItem['fuelPriceUnit'] = form.fuelPriceUnit === 'gal' ? 'gal' : 'L';
    const normalizedFuelPrice = normalizeNumber(form.averageFuelPrice);
    const normalizedFuelBurnPerHour = normalizeNumber(form.averageFuelBurnPerHour);
    const normalizedFuelCostPerHour = normalizedFuelPrice * normalizedFuelBurnPerHour;
    const equipmentFields = form.category === 'equipment'
      ? {
          equipmentPayment: normalizeNumber(form.equipmentPayment),
          equipmentPaymentFrequencyPerYear: normalizeNumber(form.equipmentPaymentFrequencyPerYear),
          fuelPriceUnit: normalizedFuelPriceUnit,
          averageFuelPrice: normalizedFuelPrice,
          averageFuelBurnPerHour: normalizedFuelBurnPerHour,
          fuelCostPerHour: normalizedFuelCostPerHour,
          monthlyInsuranceCost: normalizeNumber(form.monthlyInsuranceCost),
          monthlyMaintenanceCost: normalizeNumber(form.monthlyMaintenanceCost),
          sellableHoursPerYear: normalizeNumber(form.sellableHoursPerYear),
          actualMachineHoursPerYear: normalizeNumber(form.actualMachineHoursPerYear),
        }
      : {
          equipmentPayment: undefined,
          equipmentPaymentFrequencyPerYear: undefined,
          fuelPriceUnit: undefined,
          averageFuelPrice: undefined,
          averageFuelBurnPerHour: undefined,
          fuelCostPerHour: undefined,
          monthlyInsuranceCost: undefined,
          monthlyMaintenanceCost: undefined,
          sellableHoursPerYear: undefined,
          actualMachineHoursPerYear: undefined,
        };
    const yearlyForm = {
      ...form,
      costCode: normalizedCostCode ? normalizedCostCode.toUpperCase() : undefined,
      ...equipmentFields,
      period: `${year}-01`,
    };
    if (editing) updateBudgetItem(editing.id, yearlyForm);
    else addBudgetItem(yearlyForm);
    setModalOpen(false);
  };
  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const openCategoryEditor = (category: BudgetCategory) => {
    const existingItem = items.find((item) => item.category === category);
    if (existingItem) {
      openEdit(existingItem);
      return;
    }

    const defaultPeriod = `${year}-01`;
    const defaultEquipmentInfo = category === 'equipment' ? equipmentInfoDefaults() : null;
    setEditing(null);
    setForm({
      ...empty(),
      category,
      equipmentCostType: category === 'equipment' ? 'financed' : undefined,
      ...(defaultEquipmentInfo ?? {}),
      period: defaultPeriod,
    });
    if (defaultEquipmentInfo) {
      setAverageFuelPriceInput(formatNumericDisplayValue(defaultEquipmentInfo.averageFuelPrice));
      setAverageFuelBurnPerHourInput(formatNumericDisplayValue(defaultEquipmentInfo.averageFuelBurnPerHour));
    } else {
      setAverageFuelPriceInput('0');
      setAverageFuelBurnPerHourInput('0');
    }
    setModalOpen(true);
  };

  // Summaries
  const revenue = items.filter((b) => b.category === 'revenue');
  const expenses = items.filter((b) => b.category !== 'revenue');

  const totalBudgetedRevenue = revenue.reduce((s, b) => s + b.budgeted, 0);
  const totalActualRevenue = revenue.reduce((s, b) => s + b.actual, 0);
  const totalBudgetedExpenses = expenses.reduce((s, b) => s + b.budgeted, 0);
  const budgetedProfit = totalBudgetedRevenue - totalBudgetedExpenses;

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

  const equipmentByCostType = useMemo(() => {
    const equipmentItems = grouped.equipment;
    const totalFor = (costType: EquipmentCostType) => ({
      budgeted: equipmentItems
        .filter((item) => (item.equipmentCostType ?? 'other') === costType)
        .reduce((sum, item) => sum + item.budgeted, 0),
      actual: equipmentItems
        .filter((item) => (item.equipmentCostType ?? 'other') === costType)
        .reduce((sum, item) => sum + item.actual, 0),
    });

    return {
      financed: totalFor('financed'),
      leased: totalFor('leased'),
      other: totalFor('other'),
    };
  }, [grouped.equipment]);

  const selectedCategory = activeTab !== 'analysis' ? activeTab : null;
  const selectedCategoryItems = selectedCategory ? grouped[selectedCategory] : [];
  const equipmentFilteredItems = useMemo(() => {
    if (equipmentTableView === 'all') return grouped.equipment;
    return grouped.equipment.filter((item) => (item.equipmentCostType ?? 'other') === equipmentTableView);
  }, [equipmentTableView, grouped.equipment]);

  const displayCategoryItems = activeTab === 'equipment' ? equipmentFilteredItems : selectedCategoryItems;

  const selectedCategoryTotals = selectedCategory
    ? {
        budgeted: displayCategoryItems.reduce((sum, item) => sum + item.budgeted, 0),
        actual: displayCategoryItems.reduce((sum, item) => sum + item.actual, 0),
      }
    : { budgeted: 0, actual: 0 };

  const tabLabel = categoryTabs.find((tab) => tab.key === activeTab)?.label ?? 'Analysis';

  const directCostCategories: BudgetCategory[] = ['labour', 'materials', 'equipment', 'subcontractors'];
  const operatingExpenseCategories: BudgetCategory[] = ['overhead', 'marketing', 'insurance', 'other'];

  const revenueItems = items.filter((item) => item.category === 'revenue');
  const directCostItems = items.filter((item) => directCostCategories.includes(item.category));
  const operatingExpenseItems = items.filter((item) => operatingExpenseCategories.includes(item.category));

  const budgetedDirectCosts = directCostItems.reduce((sum, item) => sum + item.budgeted, 0);
  const budgetedOperatingExpenses = operatingExpenseItems.reduce((sum, item) => sum + item.budgeted, 0);

  const budgetedGrossProfit = totalBudgetedRevenue - budgetedDirectCosts;
  const budgetedNetProfit = budgetedGrossProfit - budgetedOperatingExpenses;

  const budgetedGrossMarginPct = totalBudgetedRevenue > 0 ? (budgetedGrossProfit / totalBudgetedRevenue) * 100 : 0;
  const budgetedNetMarginPct = totalBudgetedRevenue > 0 ? (budgetedNetProfit / totalBudgetedRevenue) * 100 : 0;

  const currentRevenuePlanRecord = useMemo(() => {
    return revenueSalesGoals.find((goal) => goal.scopeType === revenueScopeType && goal.scopeValue === revenueScopeValue);
  }, [revenueSalesGoals, revenueScopeType, revenueScopeValue]);

  const currentRevenuePlan = currentRevenuePlanRecord ?? {
    id: buildRevenueSalesGoalId(revenueScopeType, revenueScopeValue),
    scopeType: revenueScopeType,
    scopeValue: revenueScopeValue,
    goalRevenue: totalBudgetedRevenue > 0 ? totalBudgetedRevenue : totalActualRevenue,
    workingDays: DEFAULT_WORKING_DAYS_YEAR,
  };

  const revenuePerDayNeeded = currentRevenuePlan.workingDays > 0
    ? currentRevenuePlan.goalRevenue / currentRevenuePlan.workingDays
    : 0;

  useEffect(() => {
    if (currentRevenuePlanRecord) return;
    upsertRevenueSalesGoal({
      id: buildRevenueSalesGoalId(revenueScopeType, revenueScopeValue),
      scopeType: revenueScopeType,
      scopeValue: revenueScopeValue,
      goalRevenue: totalBudgetedRevenue > 0 ? totalBudgetedRevenue : totalActualRevenue,
      workingDays: DEFAULT_WORKING_DAYS_YEAR,
    });
  }, [
    currentRevenuePlanRecord,
    revenueScopeType,
    revenueScopeValue,
    totalBudgetedRevenue,
    totalActualRevenue,
    upsertRevenueSalesGoal,
  ]);

  const updateRevenuePlan = (key: 'goalRevenue' | 'workingDays', value: number) => {
    const sanitizedValue = Math.max(0, Number.isFinite(value) ? value : 0);
    const next: RevenueSalesGoal = {
      ...currentRevenuePlan,
      [key]: sanitizedValue,
    };
    upsertRevenueSalesGoal(next);
  };

  const exportMetricHeaders = () => {
    return ['Budgeted'];
  };

  const exportMetricCells = (budgeted: number) => {
    return [formatCurrency(budgeted)];
  };

  const exportMarginCells = (budgetedPct: number) => {
    return [`${budgetedPct.toFixed(1)}%`];
  };

  const openExportModal = (kind: ExportKind) => {
    setExportKind(kind);
    setExportColumnMode('budgeted');
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

  const exportToPdf = (mode: ExportColumnMode = 'budgeted') => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const scopeTypeLabel = 'Yearly';
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
        head: [['Summary', ...exportMetricHeaders()]],
        body: [
          ['Revenue', ...exportMetricCells(totalBudgetedRevenue)],
          ['Expenses', ...exportMetricCells(totalBudgetedExpenses)],
          ['Profit', ...exportMetricCells(budgetedProfit)],
        ],
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 220,
        head: [['Category', ...exportMetricHeaders(), 'Items']],
        body: categoryRows.map((row) => [
          row.category.replace(/_/g, ' '),
          ...exportMetricCells(row.budgeted),
          String(row.count),
        ]),
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 390,
        head: [[
          'Category',
          'Cost Code',
          'Description',
          ...exportMetricHeaders(),
        ]],
        body: items.map((item) => {
          return [
            item.category.replace(/_/g, ' '),
            item.costCode ?? '—',
            item.description,
            ...exportMetricCells(item.budgeted),
          ];
        }),
        styles: { fontSize: 8 },
      });
    } else {
      autoTable(doc, {
        startY: 104,
        head: [['Category Totals', ...exportMetricHeaders()]],
        body: [[
          tabLabel,
          ...exportMetricCells(selectedCategoryTotals.budgeted),
        ]],
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: 170,
        head: [[
          'Cost Code',
          'Description',
          ...exportMetricHeaders(),
        ]],
        body: selectedCategoryItems.map((item) => {
          return [
            item.costCode ?? '—',
            item.description,
            ...exportMetricCells(item.budgeted),
          ];
        }),
        styles: { fontSize: 9 },
      });
    }

    doc.save(`budget-${activeTab}-${scopeLabel}-${mode}.pdf`);
  };

  const exportProfitAndLossPdf = (condensed = false, mode: ExportColumnMode = 'budgeted') => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const scopeTypeLabel = 'Yearly';
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text(`OliveOps Profit & Loss Statement${condensed ? ' (1-Page)' : ''}`, 40, 42);
    doc.setFontSize(10);
    doc.text(`Scope: ${scopeTypeLabel} (${scopeLabel})`, 40, 60);
    doc.text(`Generated: ${generatedAt}`, 40, 74);

    autoTable(doc, {
      startY: 92,
      head: [['P&L Summary', ...exportMetricHeaders()]],
      body: [
        ['Revenue', ...exportMetricCells(totalBudgetedRevenue)],
        ['Direct Costs (Labour + Materials + Equipment + Subcontractors)', ...exportMetricCells(budgetedDirectCosts)],
        ['Gross Profit', ...exportMetricCells(budgetedGrossProfit)],
        ['Operating Expenses', ...exportMetricCells(budgetedOperatingExpenses)],
        ['Net Profit', ...exportMetricCells(budgetedNetProfit)],
      ],
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: 232,
      head: [['Margin Analysis', ...exportMetricHeaders()]],
      body: [
        ['Gross Margin %', ...exportMarginCells(budgetedGrossMarginPct)],
        ['Net Margin %', ...exportMarginCells(budgetedNetMarginPct)],
      ],
      styles: { fontSize: 9 },
    });

    if (condensed) {
      autoTable(doc, {
        startY: 314,
        head: [['Cost Category Snapshot', ...exportMetricHeaders()]],
        body: [
          ['Labour', ...exportMetricCells(grouped.labour.reduce((sum, item) => sum + item.budgeted, 0))],
          ['Materials', ...exportMetricCells(grouped.materials.reduce((sum, item) => sum + item.budgeted, 0))],
          ['Equipment', ...exportMetricCells(grouped.equipment.reduce((sum, item) => sum + item.budgeted, 0))],
          ['Subcontractors', ...exportMetricCells(grouped.subcontractors.reduce((sum, item) => sum + item.budgeted, 0))],
          ['Overhead', ...exportMetricCells(grouped.overhead.reduce((sum, item) => sum + item.budgeted, 0))],
        ],
        styles: { fontSize: 9 },
      });

      doc.save(`profit-loss-${scopeTypeLabel.toLowerCase()}-${scopeLabel}-1-page-${mode}.pdf`);
      return;
    }

    autoTable(doc, {
      startY: 314,
      head: [['Cost Code', 'Revenue Description', ...exportMetricHeaders()]],
      body: revenueItems.map((item) => [
        item.costCode ?? '—',
        item.description,
        ...exportMetricCells(item.budgeted),
      ]),
      styles: { fontSize: 8 },
    });

    const cogsStartY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 314) + 16
      : 430;

    autoTable(doc, {
      startY: cogsStartY,
      head: [['Cost Code', 'Direct Cost Description', 'Category', ...exportMetricHeaders()]],
      body: directCostItems.map((item) => [
        item.costCode ?? '—',
        item.description,
        item.category.replace(/_/g, ' '),
        ...exportMetricCells(item.budgeted),
      ]),
      styles: { fontSize: 8 },
    });

    const opexStartY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cogsStartY) + 16
      : cogsStartY + 120;

    autoTable(doc, {
      startY: opexStartY,
      head: [['Cost Code', 'Operating Expense Description', 'Category', ...exportMetricHeaders()]],
      body: operatingExpenseItems.map((item) => [
        item.costCode ?? '—',
        item.description,
        item.category.replace(/_/g, ' '),
        ...exportMetricCells(item.budgeted),
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`profit-loss-${scopeTypeLabel.toLowerCase()}-${scopeLabel}-${mode}.pdf`);
  };

  const updatePricingInput = (key: keyof typeof pricingInputs, value: number) => {
    const next = Number.isFinite(value) ? value : 0;
    setPricingInputs((current) => ({ ...current, [key]: Math.max(0, next) }));
  };

  const normalizedAverageFuelPrice = Math.max(0, Number.isFinite(form.averageFuelPrice ?? 0) ? (form.averageFuelPrice ?? 0) : 0);
  const normalizedAverageFuelBurnPerHour = Math.max(0, Number.isFinite(form.averageFuelBurnPerHour ?? 0) ? (form.averageFuelBurnPerHour ?? 0) : 0);
  const calculatedFuelCostPerHour = normalizedAverageFuelPrice * normalizedAverageFuelBurnPerHour;

  const marginDivisor = Math.max(0.01, 1 - pricingInputs.targetMarginPct / 100);
  const activeEmployees = employees.filter((employee) => employee.active);
  const averageBaseLaborRate =
    activeEmployees.length > 0
      ? activeEmployees.reduce((sum, employee) => sum + employee.hourlyRate, 0) / activeEmployees.length
      : 0;

  const loadedLaborCostPerHour = averageBaseLaborRate * (1 + pricingInputs.payrollBurdenPct / 100);
  const laborBreakEvenRate = loadedLaborCostPerHour * (1 + pricingInputs.overheadRecoveryPct / 100);
  const suggestedLaborSellRate = laborBreakEvenRate / marginDivisor;

  const periodEquipmentBudget = items
    .filter((item) => item.category === 'equipment')
    .reduce((sum, item) => sum + item.budgeted, 0);
  const machineBaseCostPerHour =
    pricingInputs.equipmentUtilizationHours > 0
      ? periodEquipmentBudget / pricingInputs.equipmentUtilizationHours
      : 0;
  const machineBreakEvenRate = machineBaseCostPerHour * (1 + pricingInputs.overheadRecoveryPct / 100);
  const suggestedMachineSellRate = machineBreakEvenRate / marginDivisor;

  const materialSellMultiplier =
    (1 + pricingInputs.materialWastePct / 100) * (1 + pricingInputs.overheadRecoveryPct / 100) / marginDivisor;
  const suggestedMaterialMarkupPct = (materialSellMultiplier - 1) * 100;

  const subcontractorSellMultiplier =
    (1 + pricingInputs.subcontractorRiskPct / 100) * (1 + pricingInputs.overheadRecoveryPct / 100) / marginDivisor;
  const suggestedSubcontractorMarkupPct = (subcontractorSellMultiplier - 1) * 100;

  const updateLabourPlan = (employeeId: string, key: keyof LabourBudgetPlan, value: number | LabourCompType) => {
    const employee = activeEmployees.find((value) => value.id === employeeId);
    if (!employee) return;

    const existing = plansByEmployeeId[employeeId] ?? defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate);
    const next = { ...existing, [key]: value };
    upsertLabourBudgetPlan(next);
  };

  const updateBillablePct = (employeeId: string, billablePct: number) => {
    const employee = activeEmployees.find((value) => value.id === employeeId);
    if (!employee) return;

    const existing = plansByEmployeeId[employeeId] ?? defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate);
    const clampedPct = Math.max(0, Math.min(100, Number.isFinite(billablePct) ? billablePct : 0));
    const nonOvertimeHours = Math.max(1, existing.billableHoursYear + existing.unbillableHoursYear);
    const nextBillableHours = Math.round((clampedPct / 100) * nonOvertimeHours);
    const nextUnbillableHours = Math.max(0, nonOvertimeHours - nextBillableHours);

    upsertLabourBudgetPlan({
      ...existing,
      billableHoursYear: nextBillableHours,
      unbillableHoursYear: nextUnbillableHours,
    });
  };

  const labourPlannerRows = useMemo(() => {
    return activeEmployees.map((employee) => {
      const plan = plansByEmployeeId[employee.id] ?? defaultLabourPlan(employee.id, plannerYear, employee.hourlyRate);

      const baseHourlyRate = plan.compType === 'hourly'
        ? plan.hourlyRate
        : (plan.annualSalary / yearlyHoursBase);
      const annualBasePay = plan.compType === 'hourly'
        ? plan.billableHoursYear * baseHourlyRate
        : plan.annualSalary;
      const labourBurdenAmount = annualBasePay * (plan.labourBurdenPct / 100);
      const annualLabourCost = annualBasePay + labourBurdenAmount;
      const trueCostPerHour = plan.billableHoursYear > 0
        ? annualLabourCost / plan.billableHoursYear
        : 0;
      const suggestedChargeOutRate = (trueCostPerHour * (1 + pricingInputs.overheadRecoveryPct / 100)) / marginDivisor;
      const annualRevenueGenerated = suggestedChargeOutRate * plan.billableHoursYear;
      const grossProfitGenerated = annualRevenueGenerated - annualLabourCost;

      return {
        employee,
        plan,
        payBasisRate: baseHourlyRate,
        labourBurdenAmount,
        trueCostPerHour,
        suggestedChargeOutRate,
        annualLabourCost,
        annualRevenueGenerated,
        grossProfitGenerated,
      };
    });
  }, [activeEmployees, marginDivisor, plannerYear, plansByEmployeeId, pricingInputs.overheadRecoveryPct]);

  const visibleLabourPlannerRows = useMemo(() => {
    if (labourTableView === 'all') return labourPlannerRows;
    return labourPlannerRows.filter((row) => row.plan.compType === labourTableView);
  }, [labourPlannerRows, labourTableView]);

  const visibleLabourPlannerTotals = useMemo(() => {
    return visibleLabourPlannerRows.reduce((acc, row) => ({
      annualLabourCost: acc.annualLabourCost + row.annualLabourCost,
      annualRevenueGenerated: acc.annualRevenueGenerated + row.annualRevenueGenerated,
      grossProfitGenerated: acc.grossProfitGenerated + row.grossProfitGenerated,
      billableHoursYear: acc.billableHoursYear + row.plan.billableHoursYear,
    }), {
      annualLabourCost: 0,
      annualRevenueGenerated: 0,
      grossProfitGenerated: 0,
      billableHoursYear: 0,
    });
  }, [visibleLabourPlannerRows]);

  const labourPlannerTotalsAll = useMemo(() => {
    return labourPlannerRows.reduce((acc, row) => ({
      annualLabourCost: acc.annualLabourCost + row.annualLabourCost,
      annualRevenueGenerated: acc.annualRevenueGenerated + row.annualRevenueGenerated,
      grossProfitGenerated: acc.grossProfitGenerated + row.grossProfitGenerated,
      billableHoursYear: acc.billableHoursYear + row.plan.billableHoursYear,
    }), {
      annualLabourCost: 0,
      annualRevenueGenerated: 0,
      grossProfitGenerated: 0,
      billableHoursYear: 0,
    });
  }, [labourPlannerRows]);

  const targetLabourRevenue = labourPlannerTotalsAll.annualLabourCost * (1 + pricingInputs.overheadRecoveryPct / 100) / marginDivisor;
  const requiredAverageChargeOutRate = labourPlannerTotalsAll.billableHoursYear > 0
    ? targetLabourRevenue / labourPlannerTotalsAll.billableHoursYear
    : 0;

  const labourSummary = useMemo(() => {
    const teamSize = labourPlannerRows.length;
    const totalRevenue = labourPlannerTotalsAll.annualRevenueGenerated;
    const totalGrossProfit = labourPlannerTotalsAll.grossProfitGenerated;
    const grossProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      teamSize,
      totalBillableHours: labourPlannerTotalsAll.billableHoursYear,
      totalRevenue,
      totalGrossProfit,
      grossProfitMargin,
    };
  }, [labourPlannerRows.length, labourPlannerTotalsAll]);

  const renderLabourPlannerRow = (row: typeof labourPlannerRows[number]) => (
    <tr key={row.employee.id} className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold uppercase text-brand-700">
            {row.employee.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-gray-900 leading-tight">{row.employee.name}</p>
            <p className="text-xs text-gray-500 leading-tight">{row.employee.role.replace('_', ' ')}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="inline-flex border border-gray-200 rounded-lg p-0.5 bg-white">
          <button
            type="button"
            onClick={() => updateLabourPlan(row.employee.id, 'compType', 'hourly')}
            className={`px-2 py-0.5 text-xs rounded ${row.plan.compType === 'hourly' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Hourly
          </button>
          <button
            type="button"
            onClick={() => updateLabourPlan(row.employee.id, 'compType', 'salaried')}
            className={`px-2 py-0.5 text-xs rounded ${row.plan.compType === 'salaried' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Salary
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {row.plan.compType === 'hourly' ? (
          <input
            type="text"
            inputMode="decimal"
            min={0}
            value={formatNumericDisplayValue(row.plan.hourlyRate)}
            onChange={(e) => updateLabourPlan(row.employee.id, 'hourlyRate', parseNumericInputValue(e.target.value))}
            onFocus={(e) => e.currentTarget.select()}
            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
          />
        ) : (
          <input
            type="text"
            inputMode="decimal"
            min={0}
            value={formatNumericDisplayValue(row.plan.annualSalary)}
            onChange={(e) => updateLabourPlan(row.employee.id, 'annualSalary', parseNumericInputValue(e.target.value))}
            onFocus={(e) => e.currentTarget.select()}
            className="w-28 border border-gray-300 rounded px-2 py-1 text-xs text-right"
          />
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="text"
          inputMode="decimal"
          min={0}
          max={100}
          step={1}
          value={formatNumericDisplayValue(((row.plan.billableHoursYear / Math.max(1, row.plan.billableHoursYear + row.plan.unbillableHoursYear + row.plan.overtimeHoursYear)) * 100).toFixed(0))}
          onChange={(e) => updateBillablePct(row.employee.id, parseNumericInputValue(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <input
          type="text"
          inputMode="decimal"
          min={0}
          step={0.1}
          value={formatNumericDisplayValue(row.plan.labourBurdenPct)}
          onChange={(e) => updateLabourPlan(row.employee.id, 'labourBurdenPct', parseNumericInputValue(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right"
        />
      </td>
      <td className="px-4 py-3 text-right">{formatCurrency(row.trueCostPerHour)}</td>
      <td className="px-4 py-3 text-right">
        <input
          type="text"
          inputMode="decimal"
          min={0}
          value={formatNumericDisplayValue(row.plan.billableHoursYear)}
          onChange={(e) => updateLabourPlan(row.employee.id, 'billableHoursYear', parseNumericInputValue(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
        />
      </td>
      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.annualLabourCost)}</td>
      <td className="px-4 py-3 text-center">
        <Link to="/employees" className="text-gray-500 hover:text-brand-700" aria-label="Edit employee">
          <Pencil size={14} />
        </Link>
      </td>
    </tr>
  );

  const renderCalculationDetails = () => (
    <details className="rounded-lg border border-gray-200 bg-white mt-4">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">Show Calculation Details</summary>
      <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
        <p>True Cost per Hour = Annual Labour Cost / Annual Billable Hours</p>
        <p>Suggested Charge-Out Rate = True Cost per Hour x (1 + Overhead Recovery %) / (1 - Target Margin %)</p>
        <p>Annual Revenue Generated = Annual Billable Hours x Suggested Charge-Out Rate</p>
        <p>Gross Profit Generated = Annual Revenue Generated - Annual Labour Cost</p>
        <p className="text-xs text-gray-500 mt-2">Current assumptions: Overhead Recovery {pricingInputs.overheadRecoveryPct.toFixed(1)}%, Target Margin {pricingInputs.targetMarginPct.toFixed(1)}%.</p>
      </div>
    </details>
  );

  return (
    <div>
      <PageHeader
        title={activeTab === 'labour' ? 'Labour Planner' : 'Budget'}
        subtitle={activeTab === 'labour'
          ? 'Plan your team, understand true cost, and set charge-out rates to hit your revenue goals.'
          : 'Track your company budget with category breakdowns for pricing and planning.'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openExportModal('pnl_condensed')}><FileDown size={16} /> Export P&L 1-Page</Button>
            <Button variant="secondary" onClick={() => openExportModal('pnl_detailed')}><FileDown size={16} /> Export P&L PDF</Button>
            <Button variant="secondary" onClick={() => openExportModal('budget')}><FileDown size={16} /> Export PDF</Button>
            {activeTab === 'labour' ? (
              <Button onClick={() => { window.location.href = '/employees'; }}><Plus size={16} /> Add Employee</Button>
            ) : (
              <Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>
            )}
          </div>
        }
      />

      {/* Scope selector */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Yearly</span>
          <span className="text-xs text-gray-500">Current scope: {scopeLabel}</span>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalBudgetedRevenue)}</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => setAssumptionsModalOpen(true)} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Profit</p>
                <p className={`text-xl font-bold ${budgetedProfit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(budgetedProfit)}</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('overhead')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Expenses</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalBudgetedExpenses)}</p>
                <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
          </div>

          <Card className="p-4 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Goal Planner</h2>
              <p className="text-sm text-gray-500 mt-1">Set a revenue goal and working days for {scopeLabel} to see daily revenue required to hit target.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Input
                label="Revenue Goal"
                type="number"
                min={0}
                value={currentRevenuePlan.goalRevenue}
                onChange={(e) => updateRevenuePlan('goalRevenue', Number(e.target.value))}
              />
              <Input
                label="Working Days"
                type="number"
                min={1}
                value={currentRevenuePlan.workingDays}
                onChange={(e) => updateRevenuePlan('workingDays', Number(e.target.value))}
              />
              <Card className="p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Revenue / Day Needed</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(revenuePerDayNeeded)}</p>
              </Card>
              <Card className="p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Working Days</p>
                <p className="text-lg font-semibold text-gray-900">{currentRevenuePlan.workingDays}</p>
              </Card>
            </div>
          </Card>

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
                label="Machine Utilization (hrs/year)"
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
                  <p className="text-xs text-gray-400 mt-1">Based on equipment budget {formatCurrency(periodEquipmentBudget)} for {scopeLabel}</p>
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
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setShowLabourCalcDetails((current) => !current)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showLabourCalcDetails ? 'Hide calculation details' : 'Show calculation details'}
            </button>
          </div>

          {showLabourCalcDetails && renderCalculationDetails()}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 border border-green-100 bg-gradient-to-r from-green-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Annual Labour Cost</p>
                  <p className="text-3xl font-bold text-green-700">{formatCurrency(labourPlannerTotalsAll.annualLabourCost)}</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700"><Users size={18} /></span>
              </div>
            </Card>
            <Card className="p-4 border border-blue-100 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Target Labour Revenue</p>
                  <p className="text-3xl font-bold text-blue-700">{formatCurrency(targetLabourRevenue)}</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Target size={18} /></span>
              </div>
            </Card>
            <Card className="p-4 border border-violet-100 bg-gradient-to-r from-violet-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Required Avg Charge-Out Rate</p>
                  <p className="text-3xl font-bold text-violet-700">{formatCurrency(requiredAverageChargeOutRate)}<span className="text-xl">/hr</span></p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700"><BadgeDollarSign size={18} /></span>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Employee Labour Planner</h2>
                </div>
                <div className="inline-flex border border-gray-200 rounded-lg p-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => setLabourTableView('all')}
                    className={`px-3 py-1 text-xs rounded ${labourTableView === 'all' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    All ({labourPlannerRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabourTableView('hourly')}
                    className={`px-3 py-1 text-xs rounded ${labourTableView === 'hourly' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Hourly ({labourPlannerRows.filter((row) => row.plan.compType === 'hourly').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabourTableView('salaried')}
                    className={`px-3 py-1 text-xs rounded ${labourTableView === 'salaried' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Salaried ({labourPlannerRows.filter((row) => row.plan.compType === 'salaried').length})
                  </button>
                </div>
              </div>
            </div>
            {labourPlannerRows.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">No active employees yet. Add employees first to build your labour planner.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1400px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium text-center">Wage Type</th>
                      <th className="px-4 py-3 font-medium text-right">Hourly Wage / Salary</th>
                      <th className="px-4 py-3 font-medium text-center">Billable %</th>
                      <th className="px-4 py-3 font-medium text-right">Labour Burden (%)</th>
                      <th className="px-4 py-3 font-medium text-right">True Cost / Hr</th>
                      <th className="px-4 py-3 font-medium text-right">Annual Billable Hours</th>
                      <th className="px-4 py-3 font-medium text-right">Annual Labour Cost</th>
                      <th className="px-4 py-3 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {labourTableView === 'all' ? (
                      <>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500" colSpan={9}>Hourly Employees</td>
                        </tr>
                        {labourPlannerRows.filter((row) => row.plan.compType === 'hourly').map((row) => renderLabourPlannerRow(row))}
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500" colSpan={9}>Salaried Employees</td>
                        </tr>
                        {labourPlannerRows.filter((row) => row.plan.compType === 'salaried').map((row) => renderLabourPlannerRow(row))}
                      </>
                    ) : (
                      visibleLabourPlannerRows.map((row) => renderLabourPlannerRow(row))
                    )}
                    {visibleLabourPlannerRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-4 text-sm text-gray-400" colSpan={9}>No employees in this compensation type view yet.</td>
                      </tr>
                    )}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 font-semibold" colSpan={6}>{labourTableView === 'all' ? 'Grand Totals' : 'View Totals'}</td>
                      <td className="px-4 py-2 text-right font-semibold">{visibleLabourPlannerTotals.billableHoursYear.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(visibleLabourPlannerTotals.annualLabourCost)}</td>
                      <td className="px-4 py-2 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 text-center">
                <div>
                  <p className="text-xs text-gray-500">Team Size</p>
                  <p className="font-semibold text-gray-900">{labourSummary.teamSize}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Labour Cost</p>
                  <p className="font-semibold text-green-700">{formatCurrency(labourPlannerTotalsAll.annualLabourCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Billable Hours</p>
                  <p className="font-semibold text-gray-900">{labourSummary.totalBillableHours.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(labourSummary.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Gross Profit</p>
                  <p className={`font-semibold ${labourSummary.totalGrossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(labourSummary.totalGrossProfit)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gross Profit Margin</p>
                  <p className={`font-semibold ${labourSummary.grossProfitMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{labourSummary.grossProfitMargin.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-100">
              <Link to="/employees" className="inline-flex items-center gap-2 rounded-lg border border-dashed border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                <Plus size={14} /> Add Employee
              </Link>
            </div>
          </Card>

          <p className="text-xs text-gray-500 flex items-center gap-1 -mt-2 mb-4"><Info size={12} /> True Cost per Hour includes wage plus burden components configured in your assumptions.</p>
        </>
      )}

      {activeTab === 'revenue' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <button type="button" onClick={() => openCategoryEditor('revenue')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Sales / Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalsByCategory.revenue.budgeted)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
          </div>
        </>
      )}

      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('materials')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Materials</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.materials.budgeted)}</p>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Budgeted Equipment</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.equipment.budgeted)}</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Financed Equipment</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(equipmentByCostType.financed.budgeted)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Leased Equipment</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(equipmentByCostType.leased.budgeted)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
            <button type="button" onClick={() => openCategoryEditor('equipment')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <Card className="p-4 hover:border-brand-300 cursor-pointer">
                <p className="text-xs text-gray-500">Other Equipment</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(equipmentByCostType.other.budgeted)}</p>
              <p className="text-[11px] text-gray-400 mt-2">Click to edit</p>
              </Card>
            </button>
          </div>

          <div className="mb-6">
            <div className="inline-flex border border-gray-200 rounded-lg p-0.5 bg-white">
              <button
                type="button"
                onClick={() => setEquipmentTableView('all')}
                className={`px-3 py-1 text-xs rounded ${equipmentTableView === 'all' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                All Equipment
              </button>
              <button
                type="button"
                onClick={() => setEquipmentTableView('financed')}
                className={`px-3 py-1 text-xs rounded ${equipmentTableView === 'financed' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Financed
              </button>
              <button
                type="button"
                onClick={() => setEquipmentTableView('leased')}
                className={`px-3 py-1 text-xs rounded ${equipmentTableView === 'leased' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Leased
              </button>
              <button
                type="button"
                onClick={() => setEquipmentTableView('other')}
                className={`px-3 py-1 text-xs rounded ${equipmentTableView === 'other' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Other
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'subcontractors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('subcontractors')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.subcontractors.budgeted)}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button type="button" onClick={() => openCategoryEditor('overhead')} className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
            <Card className="p-4 hover:border-brand-300 cursor-pointer">
              <p className="text-xs text-gray-500">Budgeted Overhead</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalsByCategory.overhead.budgeted)}</p>
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
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categoryRows.map((row) => (
                  <tr key={row.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2 capitalize">{row.category}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.budgeted)}</td>
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
                  <th className="px-4 py-3 font-medium">Cost Code</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((b) => {
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 capitalize">{b.category}</td>
                      <td className="px-4 py-2 text-gray-700">{b.costCode?.trim() ? b.costCode : '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        <div className="flex items-center gap-2">
                          <span>{b.description}</span>
                          {b.category === 'equipment' && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 capitalize">
                              {(b.equipmentCostType ?? 'other').replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(b.budgeted)}</td>
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
          {activeTab !== 'labour' && activeTab !== 'revenue' && (
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <Card className="p-4">
                <p className="text-xs text-gray-500">Budgeted {activeTab}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedCategoryTotals.budgeted)}</p>
              </Card>
            </div>
          )}

          {displayCategoryItems.length === 0 ? (
            <EmptyState title={`No ${activeTab} items for ${scopeLabel}`} action={<Button onClick={openNew}><Plus size={16} /> Add Budget Item</Button>} />
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                    <th className="px-4 py-3 font-medium">Cost Code</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Budgeted</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayCategoryItems.map((b) => {
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{b.costCode?.trim() ? b.costCode : '—'}</td>
                        <td className="px-4 py-2 text-gray-700">
                          <div className="flex items-center gap-2">
                            <span>{b.description}</span>
                            {b.category === 'equipment' && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 capitalize">
                                {(b.equipmentCostType ?? 'other').replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(b.budgeted)}</td>
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
            <Input
              label="Category"
              value={form.category.charAt(0).toUpperCase() + form.category.slice(1)}
              disabled
            />
            <Input label="Year" value={year} disabled />
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <Input
            label="Cost Code"
            value={form.costCode ?? ''}
            onChange={(e) => set('costCode', e.target.value)}
            placeholder="e.g. 06-200"
          />
          {form.category === 'equipment' && (
            <div className="space-y-4">
              <Select
                label="Equipment Cost Type"
                value={form.equipmentCostType ?? 'financed'}
                onChange={(e) => set('equipmentCostType', e.target.value as EquipmentCostType)}
              >
                {EQUIPMENT_COST_TYPES.map((costType) => (
                  <option key={costType} value={costType}>{costType.charAt(0).toUpperCase() + costType.slice(1)}</option>
                ))}
              </Select>

              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-sm font-medium text-gray-700 px-1">Equipment Info</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Payment</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <Input
                        type="number"
                        min={0}
                        value={form.equipmentPayment ?? 0}
                        className="pl-7"
                        onChange={(e) => set('equipmentPayment', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Input
                    label="Payment Frequency (# per year)"
                    type="number"
                    min={0}
                    value={form.equipmentPaymentFrequencyPerYear ?? 0}
                    onChange={(e) => set('equipmentPaymentFrequencyPerYear', Number(e.target.value))}
                  />
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium text-gray-700">Average Fuel Price Unit</p>
                    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                      {(['L', 'gal'] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => set('fuelPriceUnit', unit)}
                          className={`px-3 py-1 text-xs rounded ${
                            (form.fuelPriceUnit ?? 'L') === unit
                              ? 'bg-brand-600 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Fuel Price (/{form.fuelPriceUnit ?? 'L'})</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={averageFuelPriceInput}
                        className="pl-7"
                        onChange={(e) => {
                          setAverageFuelPriceInput(e.target.value);
                          set('averageFuelPrice', parseNumericInputValue(e.target.value));
                        }}
                      />
                    </div>
                  </div>
                  <Input
                    label={`Fuel Burned per Hour (${form.fuelPriceUnit ?? 'L'}/hr)`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={averageFuelBurnPerHourInput}
                    onChange={(e) => {
                      setAverageFuelBurnPerHourInput(e.target.value);
                      set('averageFuelBurnPerHour', parseNumericInputValue(e.target.value));
                    }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Fuel Cost per Hour</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={calculatedFuelCostPerHour}
                        className="pl-7"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Monthly Insurance Cost</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.monthlyInsuranceCost ?? 0}
                        className="pl-7"
                        onChange={(e) => set('monthlyInsuranceCost', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Monthly Maintenance Cost</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.monthlyMaintenanceCost ?? 0}
                        className="pl-7"
                        onChange={(e) => set('monthlyMaintenanceCost', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Input
                    label="Billable Hours per Year"
                    type="number"
                    min={0}
                    value={form.sellableHoursPerYear ?? 0}
                    onChange={(e) => set('sellableHoursPerYear', Number(e.target.value))}
                  />
                </div>
              </fieldset>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {form.category === 'equipment' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Total Equipment Cost per Year</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  <Input
                    type="number"
                    min={0}
                    value={form.budgeted}
                    className="pl-7"
                    onChange={(e) => set('budgeted', Number(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              <Input
                label="Budgeted ($)"
                type="number"
                min={0}
                value={form.budgeted}
                onChange={(e) => set('budgeted', Number(e.target.value))}
              />
            )}
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
            label="Machine Utilization (hrs/year)"
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
            disabled
          >
            <option value="budgeted">Budgeted only</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}



