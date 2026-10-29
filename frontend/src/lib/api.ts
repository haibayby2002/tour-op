/**
 * API client. The access token lives only in memory; the refresh token is an
 * HTTP-only cookie the browser sends to /api/v1/auth/refresh/ (X-Client: web).
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
const listeners = new Set<(token: string | null) => void>()

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  listeners.forEach((fn) => fn(token))
}

export function onTokenChange(fn: (token: string | null) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export class ApiError extends Error {
  status: number
  code?: string
  data: unknown
  fields: Record<string, string[]>

  constructor(status: number, data: unknown) {
    const body = (data ?? {}) as Record<string, unknown>
    const detail = typeof body.detail === 'string' ? body.detail : undefined
    super(detail ?? `Request failed (${status})`)
    this.status = status
    this.data = data
    this.code = typeof body.code === 'string' ? body.code : undefined
    this.fields = {}
    for (const [key, value] of Object.entries(body)) {
      if (key === 'detail' || key === 'code') continue
      if (Array.isArray(value)) this.fields[key] = value.map(String)
      else if (typeof value === 'string') this.fields[key] = [value]
      else if (value && typeof value === 'object') {
        // nested serializer errors: flatten one level ("local.price_max")
        for (const [sub, msgs] of Object.entries(value as Record<string, unknown>)) {
          if (Array.isArray(msgs)) this.fields[`${key}.${sub}`] = msgs.map(String)
        }
      }
    }
  }

  /** First human-readable message: detail, non_field_errors, or the first field error. */
  get firstMessage(): string {
    if (this.fields.non_field_errors?.length) return this.fields.non_field_errors[0]
    const body = (this.data ?? {}) as Record<string, unknown>
    if (typeof body.detail === 'string') return body.detail
    const first = Object.values(this.fields)[0]
    return first?.[0] ?? this.message
  }
}

/** The API couldn't be reached to refresh the session; try again later. */
export class RefreshUnavailableError extends Error {
  constructor() {
    super('Session refresh temporarily unavailable')
  }
}

/** Returns a new access token, null if the session has ended, or throws RefreshUnavailableError. */
export async function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/v1/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Client': 'web', 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (res) => {
        // Only an explicit rejection ends the session. A 5xx or proxy error while the
        // API restarts is temporary and must not log the user out.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          setAccessToken(null)
          return null
        }
        if (!res.ok) throw new RefreshUnavailableError()
        const data = await res.json()
        setAccessToken(data.access)
        return data.access as string
      })
      .catch((error) => {
        throw error instanceof RefreshUnavailableError ? error : new RefreshUnavailableError()
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

type Query = Record<string, string | number | boolean | undefined | null>

interface Options {
  method?: string
  body?: unknown
  form?: FormData
  query?: Query
  auth?: boolean
}

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}/api/v1${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = opts.body || opts.form ? 'POST' : 'GET', body, form, query, auth = true } = opts

  const send = async (token: string | null) => {
    const headers: Record<string, string> = { 'X-Client': 'web', Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && token) headers.Authorization = `Bearer ${token}`
    const lang = localStorage.getItem('i18nextLng')
    if (lang) headers['Accept-Language'] = lang
    return fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  }

  let res = await send(accessToken)
  if (res.status === 401 && auth && accessToken) {
    const fresh = await refreshAccess()
    if (fresh) res = await send(fresh)
  }
  if (res.status === 204) return undefined as T
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : undefined
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export function wsUrl(path: string) {
  const origin = BASE || window.location.origin
  const url = new URL(path, origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (accessToken) url.searchParams.set('token', accessToken)
  return url.toString()
}
