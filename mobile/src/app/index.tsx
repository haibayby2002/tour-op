import { Redirect } from 'expo-router'

import { useAuth } from '../auth/AuthContext'
import { Loading } from '../components/ui'
import { canBook } from '../lib/verification'

export default function Index() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Redirect href="/login" />
  // One verified contact is enough to use the app; Verify keeps nudging for the other.
  if (!canBook(user)) return <Redirect href="/verify" />
  return <Redirect href="/explore" />
}
