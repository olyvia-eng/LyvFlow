import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Card, Button } from '../ui';
import type { DashboardOnboardingItem } from './onboardingProgress';
import { calculateDashboardOnboardingProgress } from './onboardingProgress';

type DashboardOnboardingCardProps = {
  items: DashboardOnboardingItem[];
};

export default function DashboardOnboardingCard({ items }: DashboardOnboardingCardProps) {
  const [showCompletedChecklist, setShowCompletedChecklist] = useState(false);

  const progress = useMemo(() => calculateDashboardOnboardingProgress(items), [items]);

  useEffect(() => {
    if (!progress.isComplete) {
      setShowCompletedChecklist(false);
    }
  }, [progress.isComplete]);

  const showChecklist = !progress.isComplete || showCompletedChecklist;

  return (
    <Card>
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-brand-600 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Getting Started</p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-brand-50">Set Up OliveOps</h2>
          <p className="text-sm text-gray-600 dark:text-brand-200">{progress.completeCount} of {progress.totalCount} complete</p>
        </div>
        {progress.isComplete && !showChecklist ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowCompletedChecklist(true)}>
            View Checklist
          </Button>
        ) : null}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-brand-200">Setup Progress</span>
            <span className="font-semibold text-gray-900 dark:text-brand-50">{progress.percent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-brand-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
            <div
              className="h-full rounded-full bg-accent-600 dark:bg-accent-500 transition-all duration-700 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        {progress.isComplete && !showChecklist ? (
          <div className="rounded-xl border border-accent-200 dark:border-accent-700 bg-accent-50 dark:bg-accent-900/20 p-4">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-0.5 text-accent-700 dark:text-accent-400" />
              <div>
                <p className="font-semibold text-accent-800 dark:text-accent-300">Setup Complete</p>
                <p className="text-sm text-accent-700 dark:text-accent-400">All onboarding tasks are complete. You are ready to operate.</p>
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 dark:border-brand-600 bg-white dark:bg-brand-800 p-3">
                <div className="flex items-center gap-3">
                  {item.complete ? (
                    <CheckCircle2 size={18} className="text-accent-600 dark:text-accent-500" />
                  ) : (
                    <Circle size={18} className="text-gray-400 dark:text-brand-300" />
                  )}
                  <span className={`text-sm ${item.complete ? 'text-gray-900 dark:text-brand-100' : 'text-gray-600 dark:text-brand-200'}`}>
                    {item.label}
                  </span>
                </div>
                <Link to={item.to} className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}

        {progress.isComplete && showChecklist ? (
          <div className="pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCompletedChecklist(false)}>
              Hide Checklist
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
