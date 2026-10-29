import { Linking, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthContext'
import LanguageToggle from '../../components/LanguageToggle'
import ThemeToggle from '../../components/ThemeToggle'
import { Avatar, Badge, Button, Card, colors, H2, Loading, Notice, Screen, styles, Text } from '../../components/ui'
import { api, API_BASE } from '../../lib/api'
import type { CompletionReport, MyProfile } from '../../lib/types'

function Completion({ report, role }: { report: CompletionReport; role: 'traveler' | 'local' }) {
  const { t } = useTranslation()
  const missing = report.items.filter((i) => !i.done)
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={{ fontWeight: '600' }}>{t(`completion.title_${role}`)}</Text>
        <Text style={{ fontWeight: '700', color: colors.brand }}>{report.percent}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.subtle, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${report.percent}%`, height: '100%', backgroundColor: colors.brand }} />
      </View>
      {missing.length ? (
        <>
          <Text style={styles.hint}>{t(`completion.why_${role}`)}</Text>
          {missing.map((i) => (
            <Text key={i.key} style={styles.body}>• {t(`completion.items.${i.key}`)}: <Text style={styles.hint}>{t(`completion.hints.${i.key}`)}</Text></Text>
          ))}
        </>
      ) : (
        <Text style={{ color: colors.green }}>{t('completion.done')}</Text>
      )}
      <Text style={styles.hint}>{t('completion.disclaimer')}</Text>
    </Card>
  )
}

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { user, logout, hasRole } = useAuth()
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfile>('/profile/me/') })
  if (!user) return null
  if (isLoading || !profile) return <Loading />

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar src={profile.avatar} name={profile.public_name} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{profile.public_name}</Text>
            <View style={styles.wrap}>
              {user.roles.map((r) => <Badge key={r} tone="brand" label={t(`roles.${r}`)} />)}
              {user.email_verified && <Badge tone="blue" label={t('trust.email_verified')} />}
              {user.phone_verified && <Badge tone="blue" label={t('trust.phone_verified')} />}
            </View>
          </View>
        </View>
        <Button title={t('mobile.edit_profile')} variant="secondary" onPress={() => router.push('/profile-edit')} />
        {hasRole('LOCAL') && <Button title={t('mobile.my_public_profile')} variant="ghost" onPress={() => router.push(`/locals/${user.id}`)} />}
      </Card>
      {!(user.email_verified && user.phone_verified) && (
        <Notice title={t('verify.title')}>
          <Button small title={t('account.verify_now')} onPress={() => router.push('/verify')} />
        </Notice>
      )}
      {profile.completion.local && <Completion report={profile.completion.local} role="local" />}
      {profile.completion.traveler && <Completion report={profile.completion.traveler} role="traveler" />}
      <H2>{t('mobile.language')}</H2>
      <LanguageToggle />
      <H2>{t('mobile.theme')}</H2>
      <ThemeToggle />
      <Text style={styles.hint}>🔒 {t('profile.privacy_note')}</Text>
      <Button title={t('nav.logout')} variant="danger" onPress={logout} />
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        <Button small variant="ghost" title={t('footer.privacy')} onPress={() => Linking.openURL('https://tour-op.com/privacy')} />
        <Button small variant="ghost" title={t('account.delete_title')} onPress={() => router.push('/delete-account')} />
      </View>
      {__DEV__ && <Text style={[styles.hint, { textAlign: 'center' }]}>{t('mobile.server')}: {API_BASE}</Text>}
    </Screen>
  )
}
