import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '../auth/AuthContext'
import GoogleSignIn from '../components/GoogleSignIn'
import { cx, ErrorText, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import type { Role } from '../lib/types'

const currentYear = new Date().getFullYear()

const schema = z.object({
  full_name: z.string().trim().min(2),
  birth_year: z.coerce.number().int().min(currentYear - 110).max(currentYear - 18),
  email: z.email(),
  phone: z.string().trim().regex(/^\+?[\d\s.\-()]{8,20}$/),
  password: z.string().min(8),
  roles: z.array(z.enum(['TRAVELER', 'LOCAL'])).min(1),
  accept: z.literal(true),
})
type Values = z.input<typeof schema>

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<unknown>(null)
  const initialRole: Role = params.get('role') === 'LOCAL' ? 'LOCAL' : 'TRAVELER'
  const { register, handleSubmit, formState, watch, setValue, setError: setFieldError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { roles: [initialRole] },
  })
  const roles = watch('roles') ?? []
  const toggleRole = (role: Role) =>
    setValue('roles', roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role], { shouldValidate: true })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const parsed = schema.parse(values)
      const result = await signUp({
        full_name: parsed.full_name,
        birth_year: parsed.birth_year,
        email: parsed.email,
        phone: parsed.phone,
        password: parsed.password,
        roles: parsed.roles,
        preferred_language: i18n.language.startsWith('vi') ? 'vi' : 'en',
      })
      navigate('/verify', { replace: true, state: { debugCodes: result.debug_verification_codes } })
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, messages] of Object.entries(e.fields)) {
          if (field in schema.shape) setFieldError(field as keyof Values, { type: 'server', message: messages[0] })
        }
      }
      setError(e)
    }
  })

  const err = (name: keyof Values, key: string) => {
    const e = formState.errors[name]
    if (!e) return undefined
    return e.type === 'server' ? e.message : t(key)
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{t('auth.register_title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('auth.register_subtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
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
          <Field label={t('auth.full_name')} error={err('full_name', 'validation.name')} hint={t('auth.full_name_hint')} htmlFor="full_name">
            <input id="full_name" className="input" autoComplete="name" {...register('full_name')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.birth_year')} error={err('birth_year', 'validation.birth_year')} hint={t('auth.birth_year_hint')} htmlFor="birth_year">
              <input id="birth_year" type="number" inputMode="numeric" className="input" placeholder="1995" {...register('birth_year')} />
            </Field>
            <Field label={t('auth.phone')} error={err('phone', 'validation.phone')} htmlFor="phone">
              <input id="phone" type="tel" autoComplete="tel" className="input" placeholder="0901 234 567" {...register('phone')} />
            </Field>
          </div>
          <Field label={t('auth.email')} error={err('email', 'validation.email')} htmlFor="email">
            <input id="email" type="email" autoComplete="email" className="input" {...register('email')} />
          </Field>
          <Field label={t('auth.password')} error={err('password', 'validation.password')} hint={t('auth.password_hint')} htmlFor="password">
            <input id="password" type="password" autoComplete="new-password" className="input" {...register('password')} />
          </Field>
          <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">🔒 {t('auth.privacy_note')}</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" {...register('accept')} />
            <span>{t('auth.accept_rules')}</span>
          </label>
          {formState.errors.accept && <p className="text-xs text-red-600">{t('validation.accept')}</p>}
          <ErrorText error={error} />
          <button className="btn-primary w-full" disabled={formState.isSubmitting}>
            {t('auth.create_account')}
          </button>
        </form>
        <div className="mt-4">
          <GoogleSignIn />
        </div>
        <p className="mt-6 text-center text-sm text-stone-500">
          {t('auth.have_account')} <Link to="/login" className="link">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  )
}
