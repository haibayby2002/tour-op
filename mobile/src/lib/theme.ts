import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import * as SecureStore from 'expo-secure-store'

/** The theme the user picked on the Profile screen. 'system' follows the phone's setting. */
export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'theme'
let preference: ThemePreference = 'system'
const listeners = new Set<() => void>()

function apply(next: ThemePreference) {
  preference = next
  // Overrides what useColorScheme() reports app-wide (and native pickers/dialogs); 'unspecified' = follow the phone.
  Appearance.setColorScheme(next === 'system' ? 'unspecified' : next)
  listeners.forEach((l) => l())
}

SecureStore.getItemAsync(THEME_KEY).then((saved) => {
  if (saved === 'light' || saved === 'dark') apply(saved)
})

export function setThemePreference(next: ThemePreference) {
  apply(next)
  SecureStore.setItemAsync(THEME_KEY, next)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => preference,
  )
}
