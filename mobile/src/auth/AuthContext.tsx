import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { api, clearSession, getStoredRefresh, refreshAccess, saveSession, setSessionExpiredHandler } from '../lib/api'
import { setDevCodes } from '../lib/devCodes'
import { registerForPush } from '../lib/push'
import type { Me, Role } from '../lib/types'

export interface RegisterInput {
  full_name: string
  birth_year: number
  email: string
  phone: string
  password: string
  roles: Role[]
  preferred_language: 'vi' | 'en'
}

interface AuthResponse {
  access: string
  refresh: string
  user: Me
  debug_verification_codes?: Partial<Record<'EMAIL' | 'PHONE', string>>
}

/** Returned by /auth/google/ when the Google email has no account yet. */
export interface GoogleSignupRequired {
  signup_required: true
  email: string
  full_name: string
}

export interface GoogleSignupInput {
  full_name: string
  birth_year: number
  phone: string
  roles: Role[]
  preferred_language: 'vi' | 'en'
}

interface AuthState {
  user: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<Me>
  register: (input: RegisterInput) => Promise<AuthResponse>
  googleLogin: (idToken: string, signup?: GoogleSignupInput) => Promise<Me | GoogleSignupRequired>
  logout: () => Promise<void>
  setUser: (user: Me) => void
  hasRole: (role: Role) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null))
    let cancelled = false
    // Restore the stored session. If the API is unreachable (offline, restarting),
    // retry with backoff rather than dropping the user to the login screen.
    const restore = async (attempt = 0): Promise<void> => {
      if (!(await getStoredRefresh())) return
      try {
        if (await refreshAccess()) {
          setUser(await api<Me>('/auth/me/'))
          registerForPush()
        }
      } catch {
        if (attempt < 5 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
          return restore(attempt + 1)
        }
      }
    }
    restore().finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const accept = useCallback(async (data: AuthResponse) => {
    await saveSession(data.access, data.refresh)
    setUser(data.user)
    registerForPush()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<AuthResponse>('/auth/login/', { body: { email, password }, auth: false })
      await accept(data)
      return data.user
    },
    [accept],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await api<AuthResponse>('/auth/register/', { body: input, auth: false })
      // Store before accepting: navigation to Verify happens as soon as the user is set.
      setDevCodes(data.debug_verification_codes)
      await accept(data)
      return data
    },
    [accept],
  )

  const googleLogin = useCallback(
    async (idToken: string, signup?: GoogleSignupInput) => {
      const data = await api<AuthResponse | GoogleSignupRequired>('/auth/google/', {
        body: { id_token: idToken, ...signup },
        auth: false,
      })
      if ('signup_required' in data) return data
      setDevCodes(data.debug_verification_codes)
      await accept(data)
      return data.user
    },
    [accept],
  )

  const logout = useCallback(async () => {
    const refresh = await getStoredRefresh()
    await api('/auth/logout/', { body: { refresh }, auth: false }).catch(() => undefined)
    await clearSession()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, googleLogin, logout, setUser, hasRole: (r) => !!user?.roles.includes(r) }),
    [user, loading, login, register, googleLogin, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
