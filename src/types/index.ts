// ─── Shared ──────────────────────────────────────────────────────────────────

export type ID = string;

export interface Address {
  nickname?: string;
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
  firstName?: string;
  lastName?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  properties: Address[];
  address?: Address;
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
  proposalNumber?: string;
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

// ─── Invoices ───────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Invoice {
  id: ID;
  jobId: ID;
  customerId: ID;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  amount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export type ExpenseStatus = 'pending' | 'approved' | 'paid';

export type ExpenseCategory =
  | 'materials'
  | 'equipment'
  | 'subcontractor'
  | 'travel'
  | 'permits'
  | 'overhead'
  | 'other';

export interface Expense {
  id: ID;
  jobId?: ID;
  vendor: string;
  description: string;
  category: ExpenseCategory;
  expenseDate: string;
  amount: number;
  status: ExpenseStatus;
  notes: string;
  receiptUrl?: string;
  receiptFileId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Equipment ──────────────────────────────────────────────────────────────

export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'inactive';

export interface EquipmentAsset {
  id: ID;
  name: string;
  type: string;
  status: EquipmentStatus;
  costType: EquipmentCostType;
  serialNumber: string;
  purchaseDate?: string;
  hourlyCost: number;
  currentJobId?: ID;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialCatalogItem {
  id: ID;
  name: string;
  unit: string;
  defaultUnitCost: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackType = 'bug' | 'feature_request' | 'usability' | 'general';
export type FeedbackStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'normal' | 'high';

export interface FeedbackRecord {
  id: ID;
  businessId: ID;
  submittedByUserId: ID;
  submittedByRole: string;
  type: FeedbackType;
  message: string;
  route?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  deviceCategory?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  appVersion?: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  screenshotFileId?: ID;
  contactPreference: boolean;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
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
export type EmployeeCompensationType = 'hourly' | 'salary';
export type EmployeeLabourType = 'field_producing' | 'overhead';

export interface Employee {
  id: ID;
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  hourlyRate: number;
  compensationType?: EmployeeCompensationType;
  labourType?: EmployeeLabourType;
  paidDriveTimeEnabled?: boolean;
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
  photoAttachmentUrl?: string;
  photoAttachmentFileId?: string;
  clockInPhotoFileId?: string;
  clockOutPhotoFileId?: string;
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

// ─── Forms ───────────────────────────────────────────────────────────────────

export type FormCategory =
  | 'safety'
  | 'vehicle'
  | 'equipment'
  | 'job_site'
  | 'hr'
  | 'operations'
  | 'maintenance'
  | 'custom';

export type FormStatus = 'active' | 'draft' | 'archived';

export type FormAssignmentType =
  | 'everyone'
  | 'role'
  | 'employee'
  | 'division'
  | 'job'
  | 'equipment';

export type FormTrigger =
  | 'before_clock_in'
  | 'after_clock_out'
  | 'before_starting_job'
  | 'after_completing_job'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'on_demand';

export type FormFieldType =
  | 'section_header'
  | 'paragraph_text'
  | 'single_line_text'
  | 'multi_line_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'yes_no'
  | 'checkbox'
  | 'multiple_choice'
  | 'dropdown'
  | 'photo_upload'
  | 'file_upload'
  | 'signature'
  | 'employee_selector'
  | 'job_selector'
  | 'customer_selector';

export interface FormRecord {
  id: ID;
  name: string;
  description: string;
  category: FormCategory;
  status: FormStatus;
  assignedTo: FormAssignmentType;
  assignmentValue?: string;
  trigger: FormTrigger[];
  division?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: ID;
  formId: ID;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  order: number;
}

export type FormSubmissionStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface FormSubmission {
  id: ID;
  formId: ID;
  employeeId: ID;
  jobId?: ID;
  submittedAt: string;
  status: FormSubmissionStatus;
  submittedBy?: string;
}

export interface FormResponse {
  id: ID;
  submissionId: ID;
  fieldId: ID;
  value: string;
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

export type BudgetType = 'operating' | 'capital' | 'project' | 'forecast' | 'custom';
export type BudgetDivision = string;
export type BudgetStatus = 'draft' | 'active' | 'archived';

export interface Budget {
  id: ID;
  name: string;
  budgetType: BudgetType;
  division: BudgetDivision;
  fiscalYear: string;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

export type EquipmentCostType = 'financed' | 'leased' | 'owned';

export interface BudgetItem {
  id: ID;
  budgetId?: ID;
  category: BudgetCategory;
  equipmentCostType?: EquipmentCostType;
  costCode?: string;
  equipmentPayment?: number;
  equipmentPaymentFrequencyPerYear?: number;
  fuelPriceUnit?: 'L' | 'gal';
  averageFuelPrice?: number;
  averageFuelBurnPerHour?: number;
  fuelCostPerHour?: number;
  yearlyInsuranceCost?: number;
  yearlyMaintenanceCost?: number;
  equipmentHoursPerDay?: number;
  monthlyInsuranceCost?: number;
  monthlyMaintenanceCost?: number;
  sellableHoursPerYear?: number;
  actualMachineHoursPerYear?: number;
  description: string;
  budgeted: number;
  actual: number;
  period: string; // YYYY-MM
}

export type LabourCompType = 'hourly' | 'salaried';

export interface LabourBudgetPlan {
  id: ID;
  budgetId?: ID;
  employeeId: ID;
  year: string; // YYYY
  compType: LabourCompType;
  roleTitle?: string;
  hoursPerYear?: number;
  billablePct?: number;
  overtimeFactorPct?: number;
  payrollBurdenPct?: number;
  benefitsExtraCost?: number;
  bonus?: number;
  billableHoursYear: number;
  unbillableHoursYear: number;
  overtimeHoursYear: number;
  overtimeMultiplier: number;
  hourlyRate: number;
  annualSalary: number;
  labourBurdenPct: number;
}

export interface LabourHoursSalesGoal {
  id: ID;
  budgetId?: ID;
  year: string; // YYYY
  hoursGoal: number;
}

export interface RevenueSalesGoal {
  id: ID;
  budgetId?: ID;
  scopeType: 'year';
  scopeValue: string; // YYYY
  goalRevenue: number;
  workingDays: number;
}

export interface BudgetPeriod {
  period: string; // YYYY-MM
  items: BudgetItem[];
}
