// ─── Shared ──────────────────────────────────────────────────────────────────

export type ID = string;

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

// ─── CRM ─────────────────────────────────────────────────────────────────────

export type CustomerStatus = 'lead' | 'prospect' | 'active' | 'inactive';

export interface Customer {
  id: ID;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: Address;
  status: CustomerStatus;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Estimates ───────────────────────────────────────────────────────────────

export type LineItemCategory = 'material' | 'equipment' | 'labour' | 'subcontractor';

export interface LineItem {
  id: ID;
  category: LineItemCategory;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  markup: number; // percentage, e.g. 20 = 20%
  total: number;
}

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';

export interface Estimate {
  id: ID;
  customerId: ID;
  title: string;
  description: string;
  workAreas?: string[];
  status: EstimateStatus;
  lineItems: LineItem[];
  taxRate: number; // percentage
  notes: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  templateId?: ID;
}

export interface EstimateTemplate {
  id: ID;
  name: string;
  description: string;
  lineItems: Omit<LineItem, 'id'>[];
  taxRate: number;
  notes: string;
  createdAt: string;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export type JobStatus = 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface CostEntry {
  id: ID;
  category: LineItemCategory;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  date: string;
}

export interface Job {
  id: ID;
  estimateId?: ID;
  customerId: ID;
  title: string;
  description: string;
  workAreas?: string[];
  status: JobStatus;
  startDate: string;
  endDate?: string;
  estimatedHours: number;
  actualHours: number;
  estimatedCost: number;
  actualCosts: CostEntry[];
  contractValue: number;
  assignedEmployeeIds: ID[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Employees & Time Tracking ───────────────────────────────────────────────

export type EmployeeRole = 'admin' | 'foreman' | 'crew_member';

export interface Employee {
  id: ID;
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

export type ClockStatus = 'clocked_in' | 'clocked_out';
export type TimeEntryWorkType = 'job' | 'drive_time' | 'non_billable';

export interface TimeEntry {
  id: ID;
  employeeId: ID;
  jobId?: ID;
  jobIds?: ID[];
  workType: TimeEntryWorkType;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  notes: string;
  status: ClockStatus;
}

export interface AuditEvent {
  id: ID;
  action: 'backfill_time_entries' | string;
  actorUserId: ID;
  actorName: string;
  actorEmail: string;
  affectedEntryCount: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export type BudgetCategory =
  | 'revenue'
  | 'labour'
  | 'materials'
  | 'equipment'
  | 'subcontractors'
  | 'overhead'
  | 'marketing'
  | 'insurance'
  | 'other';

export interface BudgetItem {
  id: ID;
  category: BudgetCategory;
  description: string;
  budgeted: number;
  actual: number;
  period: string; // YYYY-MM
}

export type LabourCompType = 'hourly' | 'salaried';

export interface LabourBudgetPlan {
  id: ID;
  employeeId: ID;
  year: string; // YYYY
  compType: LabourCompType;
  billableHoursYear: number;
  unbillableHoursYear: number;
  overtimeHoursYear: number;
  overtimeMultiplier: number;
  hourlyRate: number;
  annualSalary: number;
  labourBurdenPct: number;
}

export interface BudgetPeriod {
  period: string; // YYYY-MM
  items: BudgetItem[];
}
