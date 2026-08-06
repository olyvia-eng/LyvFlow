import { useEffect, useState, type FormEvent } from 'react';
import { Card, PageHeader, Button, Input } from '../../components/ui';
import { parseStorageApiResponse } from '../../utils/fileUpload';

interface StoredFileRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  key: string;
  uploadedAt: string;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function DocumentsPage() {
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [files, setFiles] = useState<StoredFileRecord[]>([]);
  const [status, setStatus] = useState('Ready to upload a project file.');
  const [busy, setBusy] = useState(false);

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/storage?view=files', { credentials: 'include' });
      const data = await parseStorageApiResponse(response, 'Could not load files.') as { ok?: boolean; files?: StoredFileRecord[] };
      if (data.ok) {
        setFiles(data.files ?? []);
      }
    } catch {
      // Ignore refresh errors; the page will keep the latest local state.
    }
  };

  useEffect(() => {
    void loadFiles();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatus('Choose a file before uploading.');
      return;
    }

    setBusy(true);
    setStatus('Preparing secure upload...');

    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare-upload',
          fileName: fileName || selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          sizeBytes: selectedFile.size,
        }),
      });
      const data = await parseStorageApiResponse(response, 'Upload could not be prepared.') as { ok?: boolean; error?: string; uploadUrl?: string; plan?: StoredFileRecord & { fileId?: string; key?: string; fileName?: string; mimeType?: string; sizeBytes?: number } };
      if (!data?.ok || !data.uploadUrl || !data.plan) {
        throw new Error(data?.error || 'Upload could not be prepared.');
      }

      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': data.plan.mimeType || selectedFile.type || 'application/octet-stream' },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('The direct S3 upload failed.');
      }

      const completeResponse = await fetch('/api/storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete-upload',
          fileId: data.plan.fileId,
          key: data.plan.key,
          fileName: data.plan.fileName,
          mimeType: data.plan.mimeType,
          sizeBytes: data.plan.sizeBytes,
        }),
      });
      const completeData = await parseStorageApiResponse(completeResponse, 'The upload could not be finalized.') as { ok?: boolean; error?: string };
      if (!completeData?.ok) {
        throw new Error(completeData?.error || 'The upload could not be finalized.');
      }

      setStatus(`Uploaded ${data.plan.fileName} successfully.`);
      setSelectedFile(null);
      setFileName('');
      await loadFiles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (file: StoredFileRecord) => {
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare-download', key: file.key }),
      });
      const data = await parseStorageApiResponse(response, 'Download could not be prepared.') as { ok?: boolean; error?: string; downloadUrl?: string };
      if (!data?.ok || !data.downloadUrl) {
        throw new Error(data?.error || 'Download could not be prepared.');
      }
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download could not be prepared.');
    }
  };

  const handleDelete = async (file: StoredFileRecord) => {
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key: file.key }),
      });
      const data = await parseStorageApiResponse(response, 'Delete failed.') as { ok?: boolean; error?: string };
      if (!data?.ok) {
        throw new Error(data?.error || 'Delete failed.');
      }
      await loadFiles();
      setStatus(`Removed ${file.fileName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Upload files securely to business-scoped storage, then download or remove them from the same place." />
      <Card className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Suggested file name" value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Quarterly-Estimate.pdf" />
          <input
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm text-gray-700"
          />
          <Button type="submit" disabled={busy || !selectedFile}>{busy ? 'Uploading...' : 'Upload to Secure Storage'}</Button>
        </form>
        <p className="text-sm text-gray-600">{status}</p>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Stored Documents</h2>
          <span className="text-sm text-gray-500">{files.length} file{files.length === 1 ? '' : 's'}</span>
        </div>
        {files.length === 0 ? (
          <p className="text-sm text-gray-500">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {files.map((file) => (
              <li key={file.id} className="flex flex-col gap-3 rounded-2xl border border-brand-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{file.fileName}</p>
                  <p className="text-sm text-gray-500">{formatBytes(file.sizeBytes)} · {file.mimeType}</p>
                  <p className="text-xs text-gray-400">Uploaded {new Date(file.uploadedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void handleDownload(file)}>Download</Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void handleDelete(file)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
