import { isProduction } from './env.js';

export const SESSION_COOKIE = 'oliveops_session';

export function parseCookies(headerValue = '') {
  const result = {};
  headerValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return;
      const key = part.slice(0, idx);
      const value = decodeURIComponent(part.slice(idx + 1));
      result[key] = value;
    });
  return result;
}

export function buildSessionCookie(token) {
  const secure = isProduction() ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

export function buildClearedSessionCookie() {
  const secure = isProduction() ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
