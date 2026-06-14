export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

export async function api(path, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: controller.signal,
    ...options,
  }).finally(() => window.clearTimeout(timeout))
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.detail?.message || data?.detail || 'Request failed')
  }
  return data
}
