import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '../components/ui'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <EmptyState title={t('not_found.title')} action={<Link to="/" className="btn-primary">{t('not_found.home')}</Link>}>
      {t('not_found.body')}
    </EmptyState>
  )
}
