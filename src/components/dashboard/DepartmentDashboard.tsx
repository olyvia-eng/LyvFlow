import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Card, EmptyState, PageHeader, StatCard } from '../ui';

export type DepartmentKpi = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  color?: string;
};

export type DepartmentWidget = {
  title: string;
  description?: string;
  highlights?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  actionLabel?: string;
  actionTo?: string;
};

interface DepartmentDashboardProps {
  title: string;
  subtitle: string;
  kpis: DepartmentKpi[];
  widgets: DepartmentWidget[];
}

export default function DepartmentDashboard({
  title,
  subtitle,
  kpis,
  widgets,
}: DepartmentDashboardProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            icon={kpi.icon}
            color={kpi.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {widgets.map((widget) => (
          <Card key={widget.title}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-800">{widget.title}</h2>
                {widget.description && <p className="text-xs text-gray-500 mt-1">{widget.description}</p>}
              </div>
              {widget.actionLabel && widget.actionTo && (
                <Link to={widget.actionTo} className="text-xs text-brand-600 hover:underline">
                  {widget.actionLabel}
                </Link>
              )}
            </div>

            {widget.highlights && widget.highlights.length > 0 ? (
              <ul className="p-4 space-y-2">
                {widget.highlights.map((highlight) => (
                  <li key={highlight} className="text-sm text-gray-700">{highlight}</li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={widget.emptyTitle ?? 'No data yet'}
                description={widget.emptyDescription ?? 'Information for this widget will appear here.'}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
