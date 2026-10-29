import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../../auth/AuthContext'
import { Button, colors, ErrorText, Field, H1, Input, Screen, styles, Text } from '../../components/ui'
import { ApiError } from '../../lib/api'
import type { Role } from '../../lib/types'

/** After Google sign-in for a new email: the details our rules need (age, phone, role). */
export default function GoogleSignupScreen() {
  const { t, i18n } = useTranslation()
  const { googleLogin } = useAuth()
  const params = useLocalSearchParams<{ token: string; email: string; name: string }>()
  const [form, setForm] = useState({ full_name: params.name ?? '', birth_year: '', phone: '' })
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
      // On success the user is set and the (auth) layout redirects to phone verification.
      await googleLogin(params.token, {
        full_name: form.full_name.trim(),
        birth_year: Number(form.birth_year),
        phone: form.phone,
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
        <H1>{t('auth.google_finish_title')}</H1>
        <Text style={styles.hint}>{t('auth.google_finish_body', { email: params.email })}</Text>
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
        <Pressable onPress={() => setAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
          <Text style={styles.body}>{accepted ? '☑' : '☐'} {t('auth.accept_rules')}</Text>
        </Pressable>
        {error && !(error instanceof ApiError && Object.keys(error.fields).length) ? <ErrorText error={error} /> : null}
        <Button
          title={t('auth.create_account')}
          onPress={submit}
          loading={busy}
          disabled={!accepted || !roles.length || !form.full_name || !form.phone || !form.birth_year}
        />
        <Button title={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    </SafeAreaView>
  )
}
