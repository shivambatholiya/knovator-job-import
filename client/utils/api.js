// client/utils/api.js
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${path} error: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function getImportLogs(page = 1, limit = 10) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request(`/import-logs?${qs.toString()}`);
}

export async function getImportLog(id) {
  return request(`/import-logs/${id}`);
}

export async function importNow(feedUrl) {
  return request('/import-now', { method: 'POST', body: JSON.stringify({ feedUrl }) });
}

export async function importAll() {
  return request('/import-all', { method: 'POST' });
}

export async function getJobs({ page = 1, limit = 20, q = '', feedUrl = '' } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) qs.set('q', q);
  if (feedUrl) qs.set('feedUrl', feedUrl);
  return request(`/jobs?${qs.toString()}`);
}

export async function getJob(id) {
  return request(`/jobs/${id}`);
}

