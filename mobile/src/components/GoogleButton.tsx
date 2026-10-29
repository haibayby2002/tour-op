import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { getGoogleIdToken, googleSignInAvailable } from '../lib/googleSignIn'
import { colors, ErrorText, styles, Text } from './ui'

/** "Continue with Google". Hidden in Expo Go and when no client ID is configured. */
export default function GoogleButton() {
  const { t } = useTranslation()
  const { googleLogin } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (!googleSignInAvailable) return null

  const onPress = async () => {
    setError(null)
    setBusy(true)
    try {
      const idToken = await getGoogleIdToken()
      if (!idToken) return
      const result = await googleLogin(idToken)
      // Logged in: the (auth) layout redirects. New person: collect the required details.
      if ('signup_required' in result) {
        router.push({ pathname: '/google-signup', params: { token: idToken, email: result.email, name: result.full_name } })
      }
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={styles.hint}>{t('auth.or')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 999,
          paddingVertical: 12,
          backgroundColor: pressed ? colors.subtle : colors.surface,
          opacity: busy ? 0.6 : 1,
        })}
      >
        {busy ? <ActivityIndicator color={colors.brand} /> : <Image source={require('../../assets/google-g.png')} style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />}
        <Text style={{ fontWeight: '600', fontSize: 15 }}>{t('mobile.continue_with_google')}</Text>
      </Pressable>
      <ErrorText error={error} />
    </View>
  )
}
