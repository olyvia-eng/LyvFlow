import { Card, PageHeader } from '../../components/ui';

export default function DataCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Center"
        subtitle="A reliable home for shared business data, documents, and operational settings."
      />

      <Card className="p-6">
        <p className="text-sm text-gray-600">Use the settings area to manage shared catalog data such as equipment assets.</p>
      </Card>
    </div>
  );
}
