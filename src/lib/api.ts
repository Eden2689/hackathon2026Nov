export type ApiUser = { id: string; name: string; email: string; role: string; avatar: string };
const API = '/api';
let token = localStorage.getItem('buildflow_token');
export function setToken(value: string | null) { token = value; value ? localStorage.setItem('buildflow_token', value) : localStorage.removeItem('buildflow_token'); }
export async function api<T>(path: string, options: globalThis.RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body as T;
}
export async function login(email: string, password: string) { const result = await api<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setToken(result.token); return result.user; }
export function logout() { setToken(null); }
