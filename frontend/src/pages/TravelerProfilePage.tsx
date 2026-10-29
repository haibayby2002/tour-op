import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import TravelerSummary from '../components/TravelerSummary'
import { ErrorText, PageLoader } from '../components/ui'
import { api } from '../lib/api'
import { keys } from '../lib/queries'
import type { PublicProfile } from '../lib/types'

export default function TravelerProfilePage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const userId = Number(id)
  const { data, isLoading, error } = useQuery({
    queryKey: keys.publicProfile(userId, 'TRAVELER'),
    queryFn: () => api<PublicProfile>(`/users/${userId}/`, { query: { role: 'TRAVELER' } }),
  })
  if (isLoading) return <PageLoader />
  if (error || !data) return <ErrorText error={error} />
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">{t('traveler.profile_title')}</h1>
      <TravelerSummary profile={data} />
    </div>
  )
}
