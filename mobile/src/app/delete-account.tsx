import { useState } from 'react'
import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { Button, Card, ErrorText, Field, Input, Notice, Screen, styles, Text } from '../components/ui'
import { api } from '../lib/api'

/** Delete (anonymise) the account, required by Google Play for apps with sign-up. */
export default function DeleteAccountScreen() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const erased = t('delete_info.erased', { returnObjects: true }) as string[]
  const kept = t('delete_info.kept', { returnObjects: true }) as string[]

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await api('/auth/me/', { method: 'DELETE', body: { password } })
      await logout()
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Notice tone="red">{t('account.delete_body')}</Notice>
      <Card>
        <Text style={{ fontWeight: '600' }}>{t('delete_info.erased_title')}</Text>
        {erased.map((line) => <Text key={line} style={styles.body}>• {line}</Text>)}
        <Text style={{ fontWeight: '600', marginTop: 8 }}>{t('delete_info.kept_title')}</Text>
        {kept.map((line) => <Text key={line} style={styles.body}>• {line}</Text>)}
      </Card>
      {user.has_password && (
        <Field label={t('account.delete_password')}>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        </Field>
      )}
      <ErrorText error={error} />
      <Button
        title={t('account.delete_confirm')}
        variant="danger"
        loading={busy}
        disabled={busy || (user.has_password && !password)}
        onPress={submit}
      />
      <Button title={t('privacy.title')} variant="ghost" onPress={() => Linking.openURL('https://tour-op.com/privacy')} />
    </Screen>
  )
}
