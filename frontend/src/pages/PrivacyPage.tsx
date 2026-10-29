import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/ui'

export const CONTACT_EMAIL = 'support@tour-op.com'

interface Section {
  title: string
  items: string[]
}

/** Public privacy policy (linked from the Google Play listing). */
export default function PrivacyPage() {
  const { t } = useTranslation()
  const sections = t('privacy.sections', { returnObjects: true }) as Section[]
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('privacy.title')} subtitle={t('privacy.updated', { date: '2026-10-08' })} />
      <p className="text-stone-700">{t('privacy.intro')}</p>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <ul className="list-disc space-y-1 pl-5 text-stone-700">
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('privacy.contact_title')}</h2>
        <p className="text-stone-700">
          {t('privacy.contact_body')} <span className="font-medium">{CONTACT_EMAIL}</span>.{' '}
          <Link to="/delete-account" className="link">{t('privacy.delete_link')}</Link>
        </p>
      </section>
    </article>
  )
}
