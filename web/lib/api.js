export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/** Same-origin fetch wrapper. JSON in / JSON out, redirects to /login on 401. */
export async function api(path, { method = 'GET', body, headers, noRedirect } = {}) {
  const isJson = body !== undefined && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData);
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: isJson ? JSON.stringify(body) : body,
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
  if (res.status === 401 && !noRedirect && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'SERVER_ERROR');
  return data;
}

/** Translate an API error into a user-facing message. */
export function errText(e, t) {
  const code = e?.code || 'SERVER_ERROR';
  const k = `err.${code}`;
  const s = t(k);
  return s === k ? t('err.SERVER_ERROR') : s;
}

export function download(path) {
  const a = document.createElement('a');
  a.href = '/api' + path;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
