import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '../auth/AuthContext'
import GoogleSignIn from '../components/GoogleSignIn'
import { ErrorText, Field } from '../components/ui'
import { canBook } from '../lib/verification'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<unknown>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await login(values.email, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(canBook(user) ? from ?? '/explore' : '/verify', { replace: true })
    } catch (e) {
      setError(e)
    }
  })

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{t('auth.login_title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('auth.login_subtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <Field label={t('auth.email')} error={formState.errors.email && t('validation.email')} htmlFor="email">
            <input id="email" type="email" autoComplete="email" className="input" {...register('email')} />
          </Field>
          <Field label={t('auth.password')} error={formState.errors.password && t('validation.required')} htmlFor="password">
            <input id="password" type="password" autoComplete="current-password" className="input" {...register('password')} />
          </Field>
          <ErrorText error={error} />
          <button className="btn-primary w-full" disabled={formState.isSubmitting}>
            {t('auth.login')}
          </button>
        </form>
        <div className="mt-4">
          <GoogleSignIn />
        </div>
        <p className="mt-6 text-center text-sm text-stone-500">
          {t('auth.no_account')} <Link to="/register" className="link">{t('auth.register')}</Link>
        </p>
      </div>
    </div>
  )
}
