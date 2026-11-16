export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];
  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
  fieldError(field: string) { return this.details?.find((d) => d.field === field)?.message; }
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

type Opts = { method?: string; body?: unknown; form?: FormData; raw?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const init: RequestInit = { method: opts.method ?? 'GET', credentials: 'same-origin', headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { (init.headers as Record<string, string>)['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  let res: Response;
  try { res = await fetch('/api' + path, init); }
  catch { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.'); }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, true);
  }
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.', details;
    try { const j = await res.json(); msg = j.error || msg; details = j.details; } catch { /* non-JSON error */ }
    throw new ApiError(res.status, msg, details);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function downloadFile(id: string, filename: string) {
  const res = await api<Response>(`/documents/${id}/download`, { raw: true });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
