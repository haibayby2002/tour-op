import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, PageHeader } from '../components/ui'
import { CONTACT_EMAIL } from './PrivacyPage'

/** Public page explaining how to delete a Tour-op account (Google Play "delete account" URL). */
export default function DeleteAccountPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const steps = t('delete_info.steps', { returnObjects: true }) as string[]
  const erased = t('delete_info.erased', { returnObjects: true }) as string[]
  const kept = t('delete_info.kept', { returnObjects: true }) as string[]
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('delete_info.title')} subtitle={t('delete_info.subtitle')} />
      {params.get('done') && <Alert tone="green">{t('delete_info.done')}</Alert>}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('delete_info.how_title')}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-stone-700">
          {steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {user ? (
          <Link to="/account" className="btn-secondary btn-sm">{t('delete_info.go_account')}</Link>
        ) : (
          <Link to="/login" className="btn-secondary btn-sm">{t('delete_info.go_login')}</Link>
        )}
        <p className="text-sm text-stone-600">{t('delete_info.email_option', { email: CONTACT_EMAIL })}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('delete_info.erased_title')}</h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-700">{erased.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('delete_info.kept_title')}</h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-700">{kept.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </article>
  )
}
