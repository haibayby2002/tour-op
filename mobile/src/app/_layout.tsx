import '../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Fragment } from 'react'
import { useColorScheme } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '../auth/AuthContext'
import { colors, setColorScheme } from '../components/ui'
import { ApiError } from '../lib/api'
import '../lib/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

function RootStack({ scheme }: { scheme: string }) {
  const { t } = useTranslation()
  return (
    <Stack
      // On a theme change each screen remounts so its styles re-read the palette; the navigation history is kept.
      // (tabs) re-renders on its own and keys its tab screens the same way, so the open tab is kept too.
      screenLayout={({ route, children }) => (route.name === '(tabs)' ? children : <Fragment key={scheme}>{children}</Fragment>)}
      screenOptions={{
        headerTintColor: colors.brandDark,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="locals/[id]" options={{ title: '' }} />
      <Stack.Screen name="request/[localId]" options={{ title: t('local.send_request') }} />
      <Stack.Screen name="requests/[id]" options={{ title: t('request.detail_title') }} />
      <Stack.Screen name="bookings/[id]" options={{ title: '' }} />
      <Stack.Screen name="chat/[id]" options={{ title: t('nav.messages') }} />
      <Stack.Screen name="propose/[bookingId]" options={{ title: t('booking.propose'), presentation: 'modal' }} />
      <Stack.Screen name="report" options={{ title: t('report.title'), presentation: 'modal' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: t('review.submit'), presentation: 'modal' }} />
      <Stack.Screen name="profile-edit" options={{ title: t('mobile.edit_profile') }} />
      <Stack.Screen name="verify" options={{ title: t('verify.title') }} />
      <Stack.Screen name="delete-account" options={{ title: t('account.delete_title') }} />
      <Stack.Screen name="wishes/new" options={{ title: t('wishes.new_title') }} />
      <Stack.Screen name="wishes/[id]" options={{ title: t('wishes.title') }} />
    </Stack>
  )
}

export default function RootLayout() {
  // Follow the phone's light/dark setting, or the choice made on the Profile screen (lib/theme.ts).
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  setColorScheme(scheme)
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.brand, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border },
  }
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <RootStack scheme={scheme} />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
