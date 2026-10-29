import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../../auth/AuthContext'
import GoogleButton from '../../components/GoogleButton'
import { Button, colors, ErrorText, Field, H1, Input, Notice, Screen, styles, Text } from '../../components/ui'
import { ApiError } from '../../lib/api'
import type { Role } from '../../lib/types'

export default function RegisterScreen() {
  const { t, i18n } = useTranslation()
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', birth_year: '', email: '', phone: '', password: '' })
  const [roles, setRoles] = useState<Role[]>(['TRAVELER'])
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))
  const fieldError = (key: string) => (error instanceof ApiError ? error.fields[key]?.[0] : undefined)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        birth_year: Number(form.birth_year),
        roles,
        preferred_language: i18n.language.startsWith('en') ? 'en' : 'vi',
      })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <H1>{t('auth.register_title')}</H1>
        <Text style={styles.hint}>{t('auth.register_subtitle')}</Text>
        <Text style={styles.label}>{t('auth.i_want_to')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['TRAVELER', 'LOCAL'] as Role[]).map((role) => {
            const on = roles.includes(role)
            return (
              <Pressable
                key={role}
                onPress={() => setRoles((r) => (on ? r.filter((x) => x !== role) : [...r, role]))}
                style={{ flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandLight : colors.surface }}
                accessibilityState={{ selected: on }}
              >
                <Text style={{ fontWeight: '600' }}>{t(`roles.${role}`)}</Text>
                <Text style={styles.hint}>{t(`auth.role_hint_${role}`)}</Text>
              </Pressable>
            )
          })}
        </View>
        <Field label={t('auth.full_name')} error={fieldError('full_name')}>
          <Input value={form.full_name} onChangeText={set('full_name')} autoComplete="name" />
        </Field>
        <Field label={t('auth.birth_year')} hint={t('auth.birth_year_hint')} error={fieldError('birth_year')}>
          <Input value={form.birth_year} onChangeText={set('birth_year')} keyboardType="number-pad" maxLength={4} placeholder="1995" />
        </Field>
        <Field label={t('auth.phone')} error={fieldError('phone')}>
          <Input value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="0901 234 567" />
        </Field>
        <Field label={t('auth.email')} error={fieldError('email')}>
          <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.password_hint')} error={fieldError('password')}>
          <Input value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" />
        </Field>
        <Notice tone="neutral">{`🔒 ${t('auth.privacy_note')}`}</Notice>
        <Pressable onPress={() => setAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
          <Text style={styles.body}>{accepted ? '☑' : '☐'} {t('auth.accept_rules')}</Text>
        </Pressable>
        {error && !(error instanceof ApiError && Object.keys(error.fields).length) ? <ErrorText error={error} /> : null}
        <Button
          title={t('auth.create_account')}
          onPress={submit}
          loading={busy}
          disabled={!accepted || !roles.length || !form.full_name || !form.email || !form.phone || !form.password || !form.birth_year}
        />
        <GoogleButton />
        <Button title={t('auth.have_account')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    </SafeAreaView>
  )
}
