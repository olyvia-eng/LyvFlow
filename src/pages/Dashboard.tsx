import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, durationHours } from '../utils';
import { StatCard, Card, PageHeader } from '../components/ui';
import {
  Users,
  FileText,
  Briefcase,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  Circle,
  CheckCircle2,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  addMonths,
} from 'date-fns';

type TodoItem = {
  id: number;
  text: string;
  done: boolean;
};

type CalendarItem = {
  id: number;
  date: string;
  title: string;
};

const TODO_STORAGE_KEY = 'oliveops.dashboard.todos';
const CALENDAR_STORAGE_KEY = 'oliveops.dashboard.calendarItems';
const DEFAULT_TODOS: TodoItem[] = [
  { id: 1, text: 'Review today\'s clock-ins', done: false },
  { id: 2, text: 'Follow up on pending estimates', done: false },
];

function loadStoredTodos(): TodoItem[] {
  const raw = localStorage.getItem(TODO_STORAGE_KEY);
  if (!raw) return DEFAULT_TODOS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TODOS;

    const valid = parsed.filter(
      (item): item is TodoItem =>
        typeof item?.id === 'number' &&
        typeof item?.text === 'string' &&
        typeof item?.done === 'boolean'
    );

    return valid.length > 0 ? valid : DEFAULT_TODOS;
  } catch {
    return DEFAULT_TODOS;
  }
}

function loadStoredCalendarItems(): CalendarItem[] {
  const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CalendarItem =>
        typeof item?.id === 'number' &&
        typeof item?.date === 'string' &&
        typeof item?.title === 'string'
    );
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const { customers, estimates, jobs, timeEntries, employees } = useStore();
  const [todoInput, setTodoInput] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>(loadStoredTodos);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>(loadStoredCalendarItems);
  const [monthCursor, setMonthCursor] = useState(new Date());

  useEffect(() => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendarItems));
  }, [calendarItems]);

  const activeJobs = jobs.filter((j) => j.status === 'in_progress' || j.status === 'scheduled');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const pendingEstimates = estimates.filter((e) => e.status === 'draft' || e.status === 'sent');

  const totalRevenue = completedJobs.reduce((s, j) => s + j.contractValue, 0);
  const totalActualCost = completedJobs.reduce(
    (s, j) => s + j.actualCosts.reduce((ss, c) => ss + c.total, 0),
    0
  );
  const grossProfit = totalRevenue - totalActualCost;

  const activeClockedIn = timeEntries.filter((te) => te.status === 'clocked_in');

  const totalManHoursThisMonth = timeEntries
    .filter((te) => te.status === 'clocked_out')
    .reduce((s, te) => s + durationHours(te.clockIn, te.clockOut, te.breakMinutes), 0);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthCursor]);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    jobs.forEach((job) => {
      const start = new Date(job.startDate);
      if (Number.isNaN(start.getTime())) return;
      const key = format(start, 'yyyy-MM-dd');
      const existing = map.get(key) ?? [];
      existing.push(job.title);
      map.set(key, existing);
    });
    return map;
  }, [jobs]);

  const addTodo = () => {
    const text = todoInput.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { id: Date.now(), text, done: false }]);
    setTodoInput('');
  };

  const toggleTodo = (id: number) => {
    setTodos((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const removeTodo = (id: number) => {
    setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  const addCalendarItem = (day: Date) => {
    const title = window.prompt(`Add calendar item for ${format(day, 'MMM d, yyyy')}:`);
    if (!title) return;

    const clean = title.trim();
    if (!clean) return;

    setCalendarItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        date: format(day, 'yyyy-MM-dd'),
        title: clean,
      },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back — here's what's happening today."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          sub={`${completedJobs.length} completed`}
          icon={<Briefcase size={32} />}
          color="text-blue-600"
        />
        <StatCard
          label="Clocked In Now"
          value={activeClockedIn.length}
          sub={`of ${employees.filter((e) => e.active).length} active employees`}
          icon={<Clock size={32} />}
          color="text-green-600"
        />
        <StatCard
          label="Pending Estimates"
          value={pendingEstimates.length}
          sub="draft or sent"
          icon={<FileText size={32} />}
          color="text-yellow-600"
        />
        <StatCard
          label="Total Customers"
          value={customers.length}
          sub={`${customers.filter((c) => c.status === 'active').length} active`}
          icon={<Users size={32} />}
          color="text-purple-600"
        />
      </div>

      {/* Financial row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Revenue (Completed Jobs)"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign size={32} />}
        />
        <StatCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          sub={totalRevenue > 0 ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}% margin` : '—'}
          icon={<TrendingUp size={32} />}
          color={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          label="Man Hours Logged"
          value={`${totalManHoursThisMonth.toFixed(1)} hrs`}
          icon={<Clock size={32} />}
          color="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">To-Do List</h2>
            <p className="text-xs text-gray-500">Track daily admin tasks.</p>
          </div>
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                value={todoInput}
                onChange={(event) => setTodoInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTodo();
                  }
                }}
                placeholder="Add a task for today"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <button
                onClick={addTodo}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            {todos.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {todos.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <button
                      onClick={() => toggleTodo(item.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {item.done ? (
                        <CheckCircle2 size={18} className="text-green-600" />
                      ) : (
                        <Circle size={18} className="text-gray-400" />
                      )}
                      <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      onClick={() => removeTodo(item.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Calendar</h2>
            <p className="text-xs text-gray-500">Click any day to add a calendar item.</p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setMonthCursor((prev) => subMonths(prev, 1))}
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <h3 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
                <CalendarDays size={17} className="text-brand-600" />
                {format(monthCursor, 'MMMM yyyy')}
              </h3>
              <button
                onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-2 py-1 font-medium">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayJobs = jobsByDate.get(key) ?? [];
                const dayItems = calendarItems.filter((item) => item.date === key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => addCalendarItem(day)}
                    className={`min-h-24 rounded-lg border p-2 text-left transition-colors ${
                      isSameMonth(day, monthCursor)
                        ? 'bg-white border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-50 border-gray-100 text-gray-300'
                    } ${isToday(day) ? 'ring-2 ring-brand-300' : ''}`}
                    title="Click to add item"
                  >
                    <p className={`text-xs mb-1 ${isToday(day) ? 'font-bold text-brand-700' : 'text-gray-600'}`}>
                      {format(day, 'd')}
                    </p>
                    {dayItems.slice(0, 2).map((item) => (
                      <p
                        key={item.id}
                        className="text-[11px] truncate text-blue-700 bg-blue-50 rounded px-1 py-0.5 mb-1"
                      >
                        {item.title}
                      </p>
                    ))}
                    {dayItems.length > 2 && (
                      <p className="text-[11px] text-gray-500">+{dayItems.length - 2} more items</p>
                    )}
                    {dayJobs.slice(0, 1).map((title) => (
                      <p key={title} className="text-[11px] truncate text-brand-700 bg-brand-50 rounded px-1 py-0.5 mb-1">
                        Job: {title}
                      </p>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Active Jobs table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Active Jobs</h2>
            <Link to="/jobs" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No active jobs.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activeJobs.map((job) => {
                const customer = customers.find((c) => c.id === job.customerId);
                const pct = job.estimatedHours > 0 ? Math.min(100, (job.actualHours / job.estimatedHours) * 100) : 0;
                return (
                  <li key={job.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Link to={`/jobs/${job.id}`} className="text-sm font-medium text-gray-800 hover:text-brand-600 truncate">
                        {job.title}
                      </Link>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">{customer?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{job.actualHours.toFixed(1)}/{job.estimatedHours}h</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Clocked-in employees */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Currently Clocked In</h2>
            <Link to="/employees" className="text-xs text-brand-600 hover:underline">Manage</Link>
          </div>
          {activeClockedIn.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No one is clocked in right now.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activeClockedIn.map((te) => {
                const emp = employees.find((e) => e.id === te.employeeId);
                const job = jobs.find((j) => j.id === te.jobId);
                const hrs = durationHours(te.clockIn, te.clockOut, te.breakMinutes);
                return (
                  <li key={te.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{job?.title ?? '—'}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand-600">{hrs.toFixed(1)} hrs</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Alerts */}
      {activeJobs.some((j) => j.actualHours > j.estimatedHours) && (
        <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            Some jobs have exceeded their estimated hours.{' '}
            <Link to="/jobs" className="underline font-medium">Review jobs →</Link>
          </span>
        </div>
      )}
    </div>
  );
}
