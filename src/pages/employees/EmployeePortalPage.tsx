import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Card, Input, Modal, Select } from '../../components/ui';
import { durationHours, formatDateTime } from '../../utils';
import { uploadFileToStorage } from '../../utils/fileUpload';
import type { FormRecord, TimeEntryWorkType } from '../../types';

interface EmployeePortalPageProps {
  sessionEmployeeEmail?: string;
  onLogout?: () => void | Promise<void>;
}

export default function EmployeePortalPage({ sessionEmployeeEmail, onLogout }: EmployeePortalPageProps) {
  const { employees, jobs, timeEntries, forms, formSubmissions, clockIn, clockOut, addFormSubmission } = useStore();

  const [clockType, setClockType] = useState<TimeEntryWorkType>('job');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobNotes, setJobNotes] = useState('');
  const [photoAttachmentFileId, setPhotoAttachmentFileId] = useState('');
  const [photoAttachmentFileName, setPhotoAttachmentFileName] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [requiredFormsModalOpen, setRequiredFormsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'clock_in' | 'clock_out' | null>(null);
  const [requiredFormsQueue, setRequiredFormsQueue] = useState<FormRecord[]>([]);

  const sessionEmployee = useMemo(() => {
    if (!sessionEmployeeEmail) return null;
    return (
      employees.find(
        (item) => item.active && item.email.toLowerCase() === sessionEmployeeEmail.toLowerCase()
      ) ?? null
    );
  }, [employees, sessionEmployeeEmail]);

  const employee = sessionEmployee;

  const activeEntry = useMemo(() => {
    if (!employee) return null;
    return (
      timeEntries.find(
        (entry) => entry.employeeId === employee.id && entry.status === 'clocked_in'
      ) ?? null
    );
  }, [employee, timeEntries]);

  const activeJobs = jobs.filter(
    (job) => job.status === 'in_progress' || job.status === 'scheduled'
  );

  const handleLogout = () => {
    if (sessionEmployeeEmail && onLogout) {
      void onLogout();
      return;
    }

    setClockType('job');
    setSelectedJobIds([]);
    setJobNotes('');
    setPhotoAttachmentFileId('');
    setPhotoAttachmentFileName('');
    setPhotoUploading(false);
    setPhotoUploadError('');
  };

  const runClockIn = () => {
    if (!employee) return;
    if (clockType === 'job' && selectedJobIds.length === 0) return;

    clockIn(employee.id, {
      workType: clockType,
      jobIds: clockType === 'job' ? selectedJobIds : [],
    });
    setSelectedJobIds([]);
  };

  const runClockOut = () => {
    if (!activeEntry) return;
    if (!jobNotes.trim()) return;
    const nextPhotoAttachmentFileId = photoAttachmentFileId.trim() || undefined;
    clockOut(activeEntry.id, 0, jobNotes.trim(), nextPhotoAttachmentFileId);
    setJobNotes('');
    setPhotoAttachmentFileId('');
    setPhotoAttachmentFileName('');
  };

  const uploadPhotoAttachment = async (file: File) => {
    setPhotoUploadError('');
    setPhotoUploading(true);

    try {
      const upload = await uploadFileToStorage({
        file,
        entityType: 'time-entry',
        entityId: activeEntry?.id ?? '',
        category: 'clock-out-photo',
      });

      setPhotoAttachmentFileId(upload.fileId);
      setPhotoAttachmentFileName(file.name);
    } catch (error) {
      setPhotoUploadError(error instanceof Error ? error.message : 'Could not upload photo.');
      setPhotoAttachmentFileId('');
      setPhotoAttachmentFileName('');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    void uploadPhotoAttachment(file);
    event.target.value = '';
  };

  const openPhotoPicker = () => {
    if (photoUploading) return;
    photoFileInputRef.current?.click();
  };

  const clearPhotoAttachment = () => {
    setPhotoAttachmentFileId('');
    setPhotoAttachmentFileName('');
    setPhotoUploadError('');
  };

  const isFormAssignedToEmployee = (form: FormRecord) => {
    if (!employee) return false;
    if (form.assignedTo === 'everyone') return true;
    if (form.assignedTo === 'role') return form.assignmentValue === employee.role;
    if (form.assignedTo === 'employee') return form.assignmentValue === employee.id;
    if (form.assignedTo === 'job') {
      if (activeEntry?.jobId && form.assignmentValue === activeEntry.jobId) return true;
      if (selectedJobIds.includes(form.assignmentValue ?? '')) return true;
      return false;
    }
    if (form.assignedTo === 'division') {
      // TODO: Map employee to division and enforce division-scoped forms through backend policy.
      return true;
    }
    if (form.assignedTo === 'equipment') {
      // TODO: Enforce equipment-scoped forms when equipment context is attached to clock events.
      return true;
    }
    return false;
  };

  const buildMissingTriggerForms = (trigger: 'before_clock_in' | 'after_clock_out') => {
    if (!employee) return [];

    const today = new Date().toISOString().slice(0, 10);

    return forms.filter((form) => {
      if (form.status !== 'active') return false;
      if (!form.trigger.includes(trigger)) return false;
      if (!isFormAssignedToEmployee(form)) return false;

      const submittedToday = formSubmissions.some((submission) => (
        submission.formId === form.id
        && submission.employeeId === employee.id
        && submission.status === 'submitted'
        && submission.submittedAt.startsWith(today)
      ));
      return !submittedToday;
    });
  };

  const startRequiredFormsGate = (action: 'clock_in' | 'clock_out') => {
    const trigger = action === 'clock_in' ? 'before_clock_in' : 'after_clock_out';
    const requiredForms = buildMissingTriggerForms(trigger);

    if (requiredForms.length === 0) {
      if (action === 'clock_in') runClockIn();
      else runClockOut();
      return;
    }

    setPendingAction(action);
    setRequiredFormsQueue(requiredForms);
    setRequiredFormsModalOpen(true);
  };

  const markRequiredFormComplete = (formId: string) => {
    if (!employee) return;

    addFormSubmission({
      formId,
      employeeId: employee.id,
      jobId: activeEntry?.jobId ?? selectedJobIds[0],
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      submittedBy: employee.name,
    });

    setRequiredFormsQueue((current) => current.filter((form) => form.id !== formId));
  };

  const continueAfterRequiredForms = () => {
    if (requiredFormsQueue.length > 0) return;
    const action = pendingAction;
    setRequiredFormsModalOpen(false);
    setPendingAction(null);
    if (action === 'clock_in') runClockIn();
    if (action === 'clock_out') runClockOut();
  };

  const handleClockIn = () => startRequiredFormsGate('clock_in');
  const handleClockOut = () => startRequiredFormsGate('clock_out');

  const activeEntryJobTitle = useMemo(() => {
    if (!activeEntry) return '—';
    if (activeEntry.workType === 'drive_time') return 'Drive Time';
    if (activeEntry.workType === 'non_billable') return 'Non-Billable Work';

    const ids = Array.isArray(activeEntry.jobIds) && activeEntry.jobIds.length > 0
      ? activeEntry.jobIds
      : (activeEntry.jobId ? [activeEntry.jobId] : []);
    const titles = ids
      .map((id) => jobs.find((job) => job.id === id)?.title)
      .filter((value): value is string => Boolean(value));
    return titles.length > 0 ? titles.join(', ') : 'Job Work';
  }, [activeEntry, jobs]);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId]
    );
  };

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Clock Portal</h1>
              <p className="mt-1 text-sm text-gray-500">
                This view only allows clock in and clock out.
              </p>
            </div>
            <ShieldCheck className="text-brand-600" size={28} />
          </div>

          {!employee ? (
            <div className="rounded-lg border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
              Your employee profile could not be found for this account. Ask an admin to create or reconnect your employee record.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="text-base font-semibold text-gray-900">{employee.name}</p>
                <p className="text-xs text-gray-500">{employee.email} · {employee.role.replace('_', ' ')}</p>
              </div>

              {activeEntry ? (
                <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
                  <p className="font-semibold text-brand-800">You are clocked in.</p>
                  <p className="text-sm text-brand-700">
                    Since {formatDateTime(activeEntry.clockIn)}
                  </p>
                  <p className="text-sm text-brand-700">{activeEntryJobTitle}</p>
                  <p className="text-sm text-brand-700">
                    Hours so far: {durationHours(activeEntry.clockIn).toFixed(2)}
                  </p>
                  <Input
                    label="Job Notes"
                    required
                    value={jobNotes}
                    onChange={(event) => setJobNotes(event.target.value)}
                    placeholder="Required before clocking out"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Attach Photo (optional)</label>
                    <input
                      ref={photoFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelection}
                      disabled={photoUploading}
                      className="hidden"
                    />
                    {photoAttachmentFileId ? (
                      <div className="rounded-lg border border-brand-200 bg-white p-3">
                        <p className="text-sm font-semibold text-brand-700">Photo uploaded</p>
                        <p className="mt-1 text-xs text-gray-600">{photoAttachmentFileName || 'Uploaded photo'}</p>
                        <div className="mt-3 flex gap-3">
                          <button type="button" onClick={openPhotoPicker} className="text-sm font-medium text-brand-700 hover:text-brand-800">Replace</button>
                          <button type="button" onClick={clearPhotoAttachment} className="text-sm font-medium text-accent-700 hover:text-accent-800">Remove</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={openPhotoPicker} disabled={photoUploading} className="inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60">
                        Choose photo
                      </button>
                    )}
                    {photoUploading && <p className="text-xs text-gray-500">Uploading photo...</p>}
                    {photoUploadError && <p className="text-xs text-accent-700">{photoUploadError}</p>}
                  </div>
                  <Button
                    variant="danger"
                    onClick={handleClockOut}
                    disabled={!jobNotes.trim()}
                    className="w-full justify-center"
                  >
                    <LogOut size={16} /> Clock Out
                  </Button>
                  {!jobNotes.trim() && (
                    <p className="text-xs text-accent-700">Job notes are required before clocking out.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
                  <p className="font-semibold text-brand-800">Choose clock-in type</p>
                  <Select
                    value={clockType}
                    onChange={(event) => {
                      const next = event.target.value as TimeEntryWorkType;
                      setClockType(next);
                      if (next !== 'job') setSelectedJobIds([]);
                    }}
                  >
                    <option value="job">Job Work</option>
                    <option value="drive_time">Drive Time</option>
                    <option value="non_billable">Non-Billable Work</option>
                  </Select>

                  {clockType === 'job' && (
                    <div className="space-y-2">
                      <p className="text-sm text-brand-800">Select one or more jobs</p>
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-brand-200 bg-white p-2">
                        {activeJobs.map((job) => (
                          <label key={job.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.includes(job.id)}
                              onChange={() => toggleJobSelection(job.id)}
                            />
                            <span>{job.title}</span>
                          </label>
                        ))}
                        {activeJobs.length === 0 && (
                          <p className="text-sm text-brand-700 px-2 py-1">No active or scheduled jobs are available.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleClockIn}
                    disabled={clockType === 'job' && selectedJobIds.length === 0}
                    className="w-full justify-center"
                  >
                    <Clock size={16} /> Clock In
                  </Button>
                </div>
              )}

              <Button variant="secondary" onClick={handleLogout} className="w-full justify-center">
                Log Out
              </Button>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          Admin access is available in the main app at <Link to="/" className="text-brand-600 hover:underline">dashboard</Link>.
        </p>
      </div>

      <Modal
        open={requiredFormsModalOpen}
        onClose={() => setRequiredFormsModalOpen(false)}
        title="Required Forms Before Continuing"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRequiredFormsModalOpen(false)}>Cancel</Button>
            <Button onClick={continueAfterRequiredForms} disabled={requiredFormsQueue.length > 0}>Continue</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Complete required forms before {pendingAction === 'clock_in' ? 'clocking in' : 'clocking out'}.
          </p>
          {/* TODO: Replace quick-complete with full form question flow and backend-enforced trigger policy before action writes. */}
          {requiredFormsQueue.length === 0 ? (
            <p className="text-sm text-brand-700">All required forms are complete. You can continue.</p>
          ) : (
            requiredFormsQueue.map((form) => (
              <div key={form.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{form.name}</p>
                <p className="text-xs text-gray-500 mt-1">{form.description || 'No description provided.'}</p>
                <div className="mt-2">
                  <Button size="sm" onClick={() => markRequiredFormComplete(form.id)}>Mark Complete</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
