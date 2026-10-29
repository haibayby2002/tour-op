import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { api, refreshAccess, setAccessToken } from '../lib/api'
import type { Me, Role } from '../lib/types'
import i18n from '../i18n'

export interface RegisterInput {
  full_name: string
  birth_year: number
  email: string
  phone: string
  password: string
  roles: Role[]
  preferred_language: 'vi' | 'en'
}

export interface AuthResponse {
  access: string
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
  googleLogin: (idToken: string, signup?: GoogleSignupInput) => Promise<AuthResponse | GoogleSignupRequired>
  logout: () => Promise<void>
  setUser: (user: Me) => void
  reloadUser: () => Promise<Me | null>
  hasRole: (role: Role) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  const reloadUser = useCallback(async () => {
    try {
      const me = await api<Me>('/auth/me/')
      setUser(me)
      return me
    } catch {
      setUser(null)
      return null
    }
  }, [])

  // Restore the session from the HTTP-only refresh cookie on load. If the API is
  // briefly unreachable (e.g. restarting), retry instead of treating it as logged out.
  useEffect(() => {
    let cancelled = false
    const restore = async (attempt = 0): Promise<void> => {
      try {
        if (await refreshAccess()) await reloadUser()
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
  }, [reloadUser])

  const accept = useCallback((data: AuthResponse) => {
    setAccessToken(data.access)
    setUser(data.user)
    if (data.user.preferred_language && !localStorage.getItem('i18nextLng')) {
      i18n.changeLanguage(data.user.preferred_language)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<AuthResponse>('/auth/login/', { body: { email, password }, auth: false })
      accept(data)
      return data.user
    },
    [accept],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await api<AuthResponse>('/auth/register/', { body: input, auth: false })
      accept(data)
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
      if (!('signup_required' in data)) accept(data)
      return data
    },
    [accept],
  )

  const logout = useCallback(async () => {
    await api('/auth/logout/', { method: 'POST', auth: false }).catch(() => undefined)
    setAccessToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      register,
      googleLogin,
      logout,
      setUser,
      reloadUser,
      hasRole: (role) => !!user?.roles.includes(role),
    }),
    [user, loading, login, register, googleLogin, logout, reloadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
