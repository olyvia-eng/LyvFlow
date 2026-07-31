import { ArrowRightCircle } from 'lucide-react';
import { Card, PageHeader } from '../../components/ui';

interface ModulePlaceholderPageProps {
  title: string;
  question: string;
  summary: string;
}

export default function ModulePlaceholderPage({ title, question, summary }: ModulePlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle="This module is now fully routable and ready for build-out."
      />

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ArrowRightCircle size={20} />
          </span>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business Question</p>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">{question}</h2>
            <p className="text-sm leading-6 text-gray-600 max-w-3xl">{summary}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
