/**
 * Mobile API client. Access token in memory; refresh token in the device's
 * secure storage (Keychain / Keystore), as the tech-stack doc recommends.
 */
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

const REFRESH_KEY = 'tourop.refresh'

/**
 * EXPO_PUBLIC_API_URL wins. Otherwise use the dev machine running Metro (so a phone on
 * the same Wi-Fi reaches it) on EXPO_PUBLIC_API_PORT: 8010 for Docker, 8000 for runserver.
 */
function resolveBase() {
  const configured = process.env.EXPO_PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, '')
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost'
  return `http://${host}:${process.env.EXPO_PUBLIC_API_PORT ?? '8000'}`
}

export const API_BASE = resolveBase()

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
let language = 'vi'
let onSessionExpired: (() => void) | null = null

export const getAccessToken = () => accessToken
export const setLanguage = (lng: string) => {
  language = lng
}
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn
}

export async function saveSession(access: string, refresh?: string) {
  accessToken = access
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh)
}

export async function clearSession() {
  accessToken = null
  await SecureStore.deleteItemAsync(REFRESH_KEY)
}

export async function getStoredRefresh() {
  return SecureStore.getItemAsync(REFRESH_KEY)
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
    }
  }

  get firstMessage() {
    const body = (this.data ?? {}) as Record<string, unknown>
    if (typeof body.detail === 'string') return body.detail
    const first = Object.entries(this.fields)[0]
    return first ? `${first[0] === 'non_field_errors' ? '' : `${first[0]}: `}${first[1][0]}` : this.message
  }
}

/** The API couldn't be reached to refresh the session (offline, restarting); try again later. */
export class RefreshUnavailableError extends Error {
  constructor() {
    super('Session refresh temporarily unavailable')
  }
}

/** Returns a new access token, null if the session has ended, or throws RefreshUnavailableError. */
export async function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = await getStoredRefresh()
      if (!refresh) return null
      let res: Response
      try {
        res = await fetch(`${API_BASE}/api/v1/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        })
      } catch {
        throw new RefreshUnavailableError() // offline: keep the stored refresh token
      }
      // Only an explicit rejection ends the session; a 5xx is temporary.
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        await clearSession()
        onSessionExpired?.()
        return null
      }
      if (!res.ok) throw new RefreshUnavailableError()
      const data = await res.json()
      await saveSession(data.access, data.refresh)
      return data.access as string
    })().finally(() => {
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
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return `${API_BASE}/api/v1${path}${params ? `?${params}` : ''}`
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { body, form, query, auth = true } = opts
  const method = opts.method ?? (body !== undefined || form ? 'POST' : 'GET')

  const send = (token: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': language }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && token) headers.Authorization = `Bearer ${token}`
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  }

  let res = await send(accessToken)
  if (res.status === 401 && auth) {
    const fresh = await refreshAccess()
    if (fresh) res = await send(fresh)
  }
  if (res.status === 204) return undefined as T
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : undefined
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

/** Builds a FormData file part from an image-picker asset. */
export function filePart(uri: string, name = 'photo.jpg', type = 'image/jpeg') {
  return { uri, name, type } as unknown as Blob
}

export function wsUrl(path: string) {
  const base = API_BASE.replace(/^http/, 'ws')
  return `${base}${path}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''}`
}
