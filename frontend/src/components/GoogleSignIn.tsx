import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth, type AuthResponse, type GoogleSignupRequired } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import type { Role } from '../lib/types'
import { canBook } from '../lib/verification'
import { cx, ErrorText, Field, Modal } from './ui'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client).
interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Google sign-in could not load.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** "Sign in with Google" button. Renders nothing when VITE_GOOGLE_CLIENT_ID isn't set. */
export default function GoogleSignIn() {
  const { t, i18n } = useTranslation()
  const { googleLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<unknown>(null)
  const [signup, setSignup] = useState<{ idToken: string; info: GoogleSignupRequired } | null>(null)

  const finish = (data: AuthResponse) => {
    const from = (location.state as { from?: string } | null)?.from
    navigate(canBook(data.user) ? from ?? '/explore' : '/verify', { replace: true, state: { debugCodes: data.debug_verification_codes } })
  }

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            setError(null)
            try {
              const data = await googleLogin(credential)
              if ('signup_required' in data) setSignup({ idToken: credential, info: data })
              else finish(data)
            } catch (e) {
              setError(e)
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: buttonRef.current.offsetWidth || 320,
          locale: i18n.language.startsWith('vi') ? 'vi' : 'en',
        })
      })
      .catch(setError)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  if (!CLIENT_ID) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
      <ErrorText error={error} />
      <Modal open={signup !== null} onClose={() => setSignup(null)} title={t('auth.google_finish_title')}>
        {signup && <FinishSignup idToken={signup.idToken} info={signup.info} onDone={finish} />}
      </Modal>
    </div>
  )
}

const currentYear = new Date().getFullYear()
const schema = z.object({
  full_name: z.string().trim().min(2),
  birth_year: z.coerce.number().int().min(currentYear - 110).max(currentYear - 18),
  phone: z.string().trim().regex(/^\+?[\d\s.\-()]{8,20}$/),
  roles: z.array(z.enum(['TRAVELER', 'LOCAL'])).min(1),
  accept: z.literal(true),
})
type Values = z.input<typeof schema>

/** Details our rules need that Google doesn't provide: age check, phone, role. */
function FinishSignup({ idToken, info, onDone }: { idToken: string; info: GoogleSignupRequired; onDone: (d: AuthResponse) => void }) {
  const { t, i18n } = useTranslation()
  const { googleLogin } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const { register, handleSubmit, formState, watch, setValue, setError: setFieldError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: info.full_name, roles: ['TRAVELER'] },
  })
  const roles = watch('roles') ?? []
  const toggleRole = (role: Role) =>
    setValue('roles', roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role], { shouldValidate: true })
  const err = (name: keyof Values, key: string) => {
    const e = formState.errors[name]
    return e ? (e.type === 'server' ? e.message : t(key)) : undefined
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const parsed = schema.parse(values)
      const data = await googleLogin(idToken, {
        full_name: parsed.full_name,
        birth_year: parsed.birth_year,
        phone: parsed.phone,
        roles: parsed.roles,
        preferred_language: i18n.language.startsWith('vi') ? 'vi' : 'en',
      })
      if (!('signup_required' in data)) onDone(data)
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, messages] of Object.entries(e.fields)) {
          if (field in schema.shape) setFieldError(field as keyof Values, { type: 'server', message: messages[0] })
        }
      }
      setError(e)
    }
  })

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <p className="text-sm text-stone-500">{t('auth.google_finish_body', { email: info.email })}</p>
      <div>
        <span className="label">{t('auth.i_want_to')}</span>
        <div className="grid grid-cols-2 gap-3">
          {(['TRAVELER', 'LOCAL'] as Role[]).map((role) => (
            <button
              type="button"
              key={role}
              onClick={() => toggleRole(role)}
              className={cx(
                'rounded-xl border p-3 text-left text-sm transition',
                roles.includes(role) ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-stone-200 hover:border-stone-300',
              )}
              aria-pressed={roles.includes(role)}
            >
              <span className="block font-semibold">{t(`roles.${role}`)}</span>
              <span className="text-xs text-stone-500">{t(`auth.role_hint_${role}`)}</span>
            </button>
          ))}
        </div>
        {formState.errors.roles && <p className="mt-1 text-xs text-red-600">{t('validation.role')}</p>}
      </div>
      <Field label={t('auth.full_name')} error={err('full_name', 'validation.name')} htmlFor="g_full_name">
        <input id="g_full_name" className="input" autoComplete="name" {...register('full_name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('auth.birth_year')} error={err('birth_year', 'validation.birth_year')} hint={t('auth.birth_year_hint')} htmlFor="g_birth_year">
          <input id="g_birth_year" type="number" inputMode="numeric" className="input" placeholder="1995" {...register('birth_year')} />
        </Field>
        <Field label={t('auth.phone')} error={err('phone', 'validation.phone')} htmlFor="g_phone">
          <input id="g_phone" type="tel" autoComplete="tel" className="input" placeholder="0901 234 567" {...register('phone')} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" {...register('accept')} />
        <span>{t('auth.accept_rules')}</span>
      </label>
      {formState.errors.accept && <p className="text-xs text-red-600">{t('validation.accept')}</p>}
      <ErrorText error={error} />
      <button className="btn-primary w-full" disabled={formState.isSubmitting}>{t('auth.create_account')}</button>
    </form>
  )
}
