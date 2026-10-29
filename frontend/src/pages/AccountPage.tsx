import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Avatar, Badge, ErrorText, Field, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { keys } from '../lib/queries'
import type { Me, PublicCard, Role } from '../lib/types'

export default function AccountPage() {
  const { t } = useTranslation()
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: { full_name: user!.full_name, birth_year: user!.birth_year, email: user!.email, phone: user!.phone ?? '' },
  })
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => api<Me>('/auth/me/', { method: 'PATCH', body: { ...v, birth_year: Number(v.birth_year) } }),
    onSuccess: setUser,
  })

  const roleMutation = useMutation({
    mutationFn: ({ role, add }: { role: Role; add: boolean }) =>
      add ? api<Me>('/auth/roles/', { body: { role } }) : api<Me>(`/auth/roles/${role}/`, { method: 'DELETE' }),
    onSuccess: (me) => {
      setUser(me)
      queryClient.invalidateQueries({ queryKey: keys.myProfile })
    },
  })

  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const password = useMutation({
    mutationFn: () => api('/auth/me/password/', { body: pw }),
    onSuccess: () => setPw({ current_password: '', new_password: '' }),
  })

  const { data: blocks = [] } = useQuery({ queryKey: keys.blocks, queryFn: () => api<(PublicCard & { blocked_at: string })[]>('/blocks/') })
  const unblock = useMutation({
    mutationFn: (id: number) => api(`/blocks/${id}/`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.blocks }),
  })

  const [deleting, setDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const deleteAccount = useMutation({
    mutationFn: () => api('/auth/me/', { method: 'DELETE', body: { password: deletePassword } }),
    onSuccess: async () => {
      await logout()
      navigate('/delete-account?done=1', { replace: true })
    },
  })

  if (!user) return null
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <form className="card space-y-4 p-6" onSubmit={handleSubmit((v) => save.mutate(v))}>
        <p className="font-semibold">{t('account.private_info')}</p>
        <p className="text-xs text-stone-500">{t('account.private_hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.full_name')} htmlFor="a-name"><input id="a-name" className="input" {...register('full_name')} /></Field>
          <Field label={t('auth.birth_year')} htmlFor="a-by"><input id="a-by" type="number" className="input" {...register('birth_year')} /></Field>
          <Field label={t('auth.email')} hint={user.email_verified ? `✓ ${t('verify.verified')}` : t('verify.not_verified')} htmlFor="a-email">
            <input id="a-email" type="email" className="input" {...register('email')} />
          </Field>
          <Field label={t('auth.phone')} hint={user.phone_verified ? `✓ ${t('verify.verified')}` : t('verify.not_verified')} htmlFor="a-phone">
            <input id="a-phone" className="input" {...register('phone')} />
          </Field>
        </div>
        <p className="text-xs text-amber-700">{t('account.reverify_note')}</p>
        <ErrorText error={save.error} />
        <div className="flex items-center justify-between">
          {!(user.email_verified && user.phone_verified) ? <Link to="/verify" className="link text-sm">{t('account.verify_now')}</Link> : <span />}
          <button className="btn-primary" disabled={save.isPending}>{t('common.save')}</button>
        </div>
      </form>

      <div className="card space-y-3 p-6">
        <p className="font-semibold">{t('account.roles')}</p>
        {(['TRAVELER', 'LOCAL'] as Role[]).map((role) => {
          const has = user.roles.includes(role)
          return (
            <div key={role} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t(`roles.${role}`)} {has && <Badge tone="green">{t('account.active')}</Badge>}</p>
                <p className="text-xs text-stone-500">{t(`auth.role_hint_${role}`)}</p>
              </div>
              <button
                className={has ? 'btn-ghost btn-sm text-red-600' : 'btn-secondary btn-sm'}
                disabled={roleMutation.isPending || (has && user.roles.length === 1)}
                onClick={() => roleMutation.mutate({ role, add: !has })}
              >
                {has ? t('account.remove_role') : t('account.add_role')}
              </button>
            </div>
          )
        })}
        <ErrorText error={roleMutation.error} />
      </div>

      <form
        className="card space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          password.mutate()
        }}
      >
        <p className="font-semibold">{t('account.password')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('account.current_password')} htmlFor="pw-c">
            <input id="pw-c" type="password" className="input" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </Field>
          <Field label={t('account.new_password')} htmlFor="pw-n">
            <input id="pw-n" type="password" className="input" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
        </div>
        <ErrorText error={password.error} />
        {password.isSuccess && <p className="text-sm text-emerald-700">✓ {t('common.saved')}</p>}
        <div className="flex justify-end"><button className="btn-secondary" disabled={password.isPending}>{t('account.change_password')}</button></div>
      </form>

      <div className="card space-y-3 p-6">
        <p className="font-semibold">{t('account.blocked')}</p>
        {blocks.length === 0 ? (
          <p className="text-sm text-stone-500">{t('account.no_blocked')}</p>
        ) : (
          blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm"><Avatar src={b.avatar} name={b.name} size="sm" /> {b.name}</span>
              <button className="btn-ghost btn-sm" onClick={() => unblock.mutate(b.id)}>{t('account.unblock')}</button>
            </div>
          ))
        )}
      </div>

      <div className="card space-y-3 border-red-200 p-6">
        <p className="font-semibold text-red-700">{t('account.delete_title')}</p>
        <p className="text-sm text-stone-600">{t('account.delete_body')}</p>
        {!deleting ? (
          <button className="btn-secondary btn-sm text-red-600" onClick={() => setDeleting(true)}>{t('account.delete_start')}</button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              deleteAccount.mutate()
            }}
          >
            {user.has_password && (
              <Field label={t('account.delete_password')} htmlFor="del-pw">
                <input id="del-pw" type="password" className="input" required value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </Field>
            )}
            <ErrorText error={deleteAccount.error} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDeleting(false)}>{t('common.cancel')}</button>
              <button className="btn-danger" disabled={deleteAccount.isPending}>{t('account.delete_confirm')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
