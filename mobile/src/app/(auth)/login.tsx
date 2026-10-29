import { useState } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { Link } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../../auth/AuthContext'
import GoogleButton from '../../components/GoogleButton'
import LanguageToggle from '../../components/LanguageToggle'
import Logo from '../../components/Logo'
import { Button, colors, ErrorText, Field, H1, Input, Screen, styles, Text } from '../../components/ui'

export default function LoginScreen() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <View style={[styles.rowBetween, { marginBottom: 24 }]}>
            <Logo />
            <LanguageToggle />
          </View>
          <H1>{t('auth.login_title')}</H1>
          <Text style={styles.hint}>{t('auth.login_subtitle')}</Text>
          <Field label={t('auth.email')}>
            <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </Field>
          <Field label={t('auth.password')}>
            <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
          </Field>
          <ErrorText error={error} />
          <Button title={t('auth.login')} onPress={submit} loading={busy} disabled={!email || !password} />
          <GoogleButton />
          <Text style={[styles.hint, { textAlign: 'center', marginTop: 8 }]}>
            {t('auth.no_account')}{' '}
            <Link href="/register" style={{ color: colors.brand, fontWeight: '600' }}>
              {t('auth.register')}
            </Link>
          </Text>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
