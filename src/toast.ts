export type AppToastTone = 'success' | 'error';

export interface AppToastDetail {
  message: string;
  tone?: AppToastTone;
}

export const APP_TOAST_EVENT = 'oliveops:toast';

export function emitAppToast(detail: AppToastDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail }));
}
