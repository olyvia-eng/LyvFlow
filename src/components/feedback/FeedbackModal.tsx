import { useEffect, useMemo, useState } from 'react';
import type { FeedbackType } from '../../types';
import { Button, Input, Modal, Select, TextArea } from '../ui';
import { useFeedbackSubmission } from './useFeedbackSubmission';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'usability', label: 'Usability Feedback' },
  { value: 'general', label: 'General Feedback' },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [contactPreference, setContactPreference] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | undefined>();
  const [localError, setLocalError] = useState('');

  const {
    isSubmitting,
    submitError,
    lastFeedbackId,
    submitFeedback,
    resetSubmissionState,
  } = useFeedbackSubmission();

  const currentError = localError || submitError;

  const screenshotLabel = useMemo(() => {
    if (!screenshotFile) return 'No file selected';
    return `${screenshotFile.name} (${Math.round(screenshotFile.size / 1024)} KB)`;
  }, [screenshotFile]);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
  }, [open]);

  const resetForm = () => {
    setType('general');
    setMessage('');
    setContactPreference(true);
    setContactEmail('');
    setScreenshotFile(undefined);
    setLocalError('');
    resetSubmissionState();
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setLocalError('');

    if (!message.trim()) {
      setLocalError('Please describe your feedback before submitting.');
      return;
    }

    if (contactPreference && contactEmail.trim() && !isValidEmail(contactEmail.trim())) {
      setLocalError('Please provide a valid follow-up email address.');
      return;
    }

    const result = await submitFeedback({
      type,
      message: message.trim(),
      contactPreference,
      contactEmail: contactEmail.trim() || undefined,
      screenshotFile,
    });

    if (!result) return;

    setMessage('');
    setScreenshotFile(undefined);
    setLocalError('');
  };

  if (lastFeedbackId) {
    return (
      <Modal
        open={open}
        onClose={closeAndReset}
        title="Feedback Sent"
        footer={<Button onClick={closeAndReset}>Done</Button>}
      >
        <div className="space-y-3 text-sm text-brand-700 dark:text-brand-200">
          <p>Thank you for your feedback. We have logged your submission.</p>
          <p className="font-medium text-brand-900 dark:text-brand-50">Reference ID: {lastFeedbackId}</p>
          <p>Our team reviews beta feedback regularly and uses it to prioritize improvements.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      title="Send Beta Feedback"
      footer={(
        <>
          <Button variant="secondary" onClick={closeAndReset} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-brand-600 dark:text-brand-200">
          Share bugs, rough edges, or ideas. Optional screenshots help us resolve issues faster.
        </p>

        <Select label="Feedback Type" value={type} onChange={(event) => setType(event.target.value as FeedbackType)}>
          {FEEDBACK_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>

        <TextArea
          label="What happened?"
          required
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what you were trying to do and what result you expected."
        />

        <div className="rounded-xl border border-brand-100 dark:border-brand-600 bg-brand-50/60 dark:bg-brand-800/50 px-3 py-3">
          <label className="text-sm font-medium text-brand-800 dark:text-brand-100">Screenshot (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="mt-2 block w-full text-sm text-brand-700 dark:text-brand-100 file:mr-3 file:rounded-lg file:border-0 file:bg-white dark:file:bg-brand-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 dark:file:text-brand-100"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              setScreenshotFile(selectedFile);
            }}
          />
          <p className="mt-1 text-xs text-brand-500 dark:text-brand-300">{screenshotLabel}</p>
        </div>

        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-sm text-brand-700 dark:text-brand-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-brand-300 text-accent-600 focus:ring-accent-500"
              checked={contactPreference}
              onChange={(event) => setContactPreference(event.target.checked)}
            />
            We can contact you for follow-up questions
          </label>
          <Input
            label="Follow-up Email (optional)"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="you@company.com"
            disabled={!contactPreference}
          />
        </div>

        {currentError && <p className="text-sm text-accent-700">{currentError}</p>}
      </div>
    </Modal>
  );
}
