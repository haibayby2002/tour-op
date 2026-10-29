import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import { keys, useMeta } from '../lib/queries'
import type { Report } from '../lib/types'
import { Alert, ErrorText, Field, Modal } from './ui'

export interface ReportTarget {
  reported_user?: number
  booking?: number
  message?: number
  review?: number
  tour_request?: number
}

export function ReportDialog({
  open,
  onClose,
  target,
  allowDispute = false,
  defaultCategory = '',
}: {
  open: boolean
  onClose: () => void
  target: ReportTarget
  allowDispute?: boolean
  defaultCategory?: string
}) {
  const { t } = useTranslation()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const [category, setCategory] = useState(defaultCategory)
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [openDispute, setOpenDispute] = useState(false)
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const report = await api<Report>('/reports/', {
        body: { ...target, category, description, open_dispute: openDispute },
      })
      for (const file of files) {
        const form = new FormData()
        form.append('file', file)
        await api(`/reports/${report.id}/evidence/`, { form })
      }
      return report
    },
    onSuccess: () => {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: keys.reports })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })

  const close = () => {
    onClose()
    setTimeout(() => {
      setDone(false)
      setDescription('')
      setFiles([])
      setOpenDispute(false)
      mutation.reset()
    }, 200)
  }

  return (
    <Modal open={open} onClose={close} title={t('report.title')}>
      {done ? (
        <div className="space-y-4">
          <Alert tone="green" title={t('report.sent_title')}>{t('report.sent_body')}</Alert>
          <button className="btn-primary w-full" onClick={close}>{t('common.close')}</button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <p className="text-sm text-stone-500">{t('report.private_note')}</p>
          <Field label={t('report.category')} htmlFor="r-cat">
            <select id="r-cat" className="input" required value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('common.choose')}</option>
              {meta?.report_categories.map((c) => <option key={c} value={c}>{t(`report.categories.${c}`)}</option>)}
            </select>
          </Field>
          {category === 'SAFETY' && <Alert tone="red">{t('report.emergency')}</Alert>}
          <Field label={t('report.description')} htmlFor="r-desc">
            <textarea id="r-desc" className="input min-h-28" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={t('report.evidence')} hint={t('report.evidence_hint')} htmlFor="r-files">
            <input
              id="r-files"
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="block text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
            />
          </Field>
          {allowDispute && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={openDispute} onChange={(e) => setOpenDispute(e.target.checked)} />
              <span>
                <span className="font-medium">{t('report.open_dispute')}</span>
                <span className="block text-xs text-stone-500">{t('report.open_dispute_hint')}</span>
              </span>
            </label>
          )}
          <ErrorText error={mutation.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={close}>{t('common.cancel')}</button>
            <button className="btn-danger" disabled={mutation.isPending || !category || !description.trim()}>
              {t('report.submit')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function BlockButton({ userId, onBlocked }: { userId: number; onBlocked?: () => void }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api('/blocks/', { body: { user_id: userId } }),
    onSuccess: () => {
      setConfirming(false)
      queryClient.invalidateQueries()
      onBlocked?.()
    },
  })
  return (
    <>
      <button className="btn-ghost btn-sm text-stone-500" onClick={() => setConfirming(true)}>
        {t('block.button')}
      </button>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('block.confirm_title')}>
        <p className="text-sm text-stone-600">{t('block.confirm_body')}</p>
        <ErrorText error={mutation.error} />
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
          <button className="btn-danger" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{t('block.confirm')}</button>
        </div>
      </Modal>
    </>
  )
}
