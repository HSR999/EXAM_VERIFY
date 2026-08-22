export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export function privacyHeaders(screen = 'verify') {
  let context = { role: 'invigilator', intent: 'live_verification', context: 'exam_in_progress' }
  try {
    context = { ...context, ...JSON.parse(localStorage.getItem('examverify_privacy_context') || '{}') }
  } catch {
    // Keep safe fallback
  }
  return {
    'X-Viewer-Role': context.role || 'invigilator',
    'X-Viewer-Intent': context.intent || 'live_verification',
    'X-Viewer-Context': context.context || 'exam_in_progress',
    'X-Viewer-Screen': screen,
  }
}

export async function api(path, options = {}) {
  const { screen = 'verify', headers = {}, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  const url = API_URL ? `${API_URL}${path}` : path
  const response = await fetch(url, {
    ...fetchOptions,
    headers: { 'Content-Type': 'application/json', ...privacyHeaders(screen), ...headers },
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout))
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.detail?.message || data?.detail || 'Request failed')
  }
  return data
}
