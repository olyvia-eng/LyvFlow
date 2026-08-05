import { useState } from 'react';
import { Card, PageHeader, Button, Input } from '../../components/ui';

export default function DocumentsPage() {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('Ready to upload a project file.');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus('Preparing secure upload...');

    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare-upload', fileName: fileName || 'document.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }),
      });
      const data = await response.json();
      setStatus(data.ok ? 'Upload plan created securely.' : data.error || 'Upload could not be prepared.');
    } catch {
      setStatus('Upload could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Securely prepare file uploads with tenant-scoped storage and presigned S3 access." />
      <Card className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="File name" value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Quarterly-Estimate.pdf" />
          <Button type="submit" disabled={busy}>{busy ? 'Preparing...' : 'Prepare Secure Upload'}</Button>
        </form>
        <p className="text-sm text-gray-600">{status}</p>
      </Card>
    </div>
  );
}
