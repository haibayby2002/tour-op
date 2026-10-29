import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, Badge, ErrorText } from '../components/ui'
import { api } from '../lib/api'
import type { Me } from '../lib/types'
import { canBook } from '../lib/verification'

type Kind = 'EMAIL' | 'PHONE'

function VerifyCard({ kind, target, verified, initialDebugCode }: { kind: Kind; target: string; verified: boolean; initialDebugCode?: string }) {
  const { t } = useTranslation()
  const { setUser } = useAuth()
  const [code, setCode] = useState('')
  const [debugCode, setDebugCode] = useState(initialDebugCode)
  const [sent, setSent] = useState(!!initialDebugCode)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await api<{ debug_code?: string }>('/auth/verify/send/', { body: { kind } })
      setDebugCode(res.debug_code)
      setSent(true)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setError(null)
    setBusy(true)
    try {
      setUser(await api<Me>('/auth/verify/confirm/', { body: { kind, code } }))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{t(kind === 'EMAIL' ? 'verify.email' : 'verify.phone')}</p>
          <p className="text-sm text-stone-500">{target}</p>
        </div>
        {verified ? <Badge tone="green">✓ {t('verify.verified')}</Badge> : <Badge tone="amber">{t('verify.not_verified')}</Badge>}
      </div>
      {!verified && (
        <div className="mt-4 space-y-3">
          {debugCode && (
            <Alert tone="blue">
              {t('verify.dev_code')} <strong className="font-mono">{debugCode}</strong>
            </Alert>
          )}
          {sent && (
            <div className="flex gap-2">
              <input
                className="input font-mono tracking-widest"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-label={t('verify.code')}
              />
              <button className="btn-primary" onClick={confirm} disabled={busy || code.length !== 6}>
                {t('verify.confirm')}
              </button>
            </div>
          )}
          <button className="btn-secondary btn-sm" onClick={send} disabled={busy}>
            {sent ? t('verify.resend') : t('verify.send')}
          </button>
          <ErrorText error={error} />
        </div>
      )}
    </div>
  )
}

export default function VerifyPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const debugCodes = (location.state as { debugCodes?: Record<Kind, string> } | null)?.debugCodes
  if (!user) return null
  const done = user.email_verified && user.phone_verified
  const enough = canBook(user)

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('verify.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('verify.subtitle')}</p>
      </div>
      <VerifyCard kind="EMAIL" target={user.email} verified={user.email_verified} initialDebugCode={debugCodes?.EMAIL} />
      <VerifyCard kind="PHONE" target={user.phone ?? ''} verified={user.phone_verified} initialDebugCode={debugCodes?.PHONE} />
      <p className="text-xs text-stone-500">{t('verify.not_identity')}</p>
      {enough && !done && <Alert tone="green">{t('verify.one_more')}</Alert>}
      {enough ? (
        <Link to={done ? '/profile' : '/explore'} className="btn-primary w-full">{t('verify.continue')}</Link>
      ) : (
        <Link to="/explore" className="btn-ghost w-full">{t('verify.later')}</Link>
      )}
    </div>
  )
}
