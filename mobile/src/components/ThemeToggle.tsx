import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { setThemePreference, useThemePreference, type ThemePreference } from '../lib/theme'
import { colors, Text } from './ui'

export default function ThemeToggle() {
  const { t } = useTranslation()
  const current = useThemePreference()
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 2, backgroundColor: colors.surface }}>
      {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
        <Pressable
          key={option}
          onPress={() => setThemePreference(option)}
          style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: current === option ? colors.brand : 'transparent' }}
          accessibilityRole="button"
          accessibilityState={{ selected: current === option }}
        >
          <Text style={{ fontWeight: '700', fontSize: 12, color: current === option ? colors.onBrand : colors.muted }}>{t(`mobile.theme_${option}`)}</Text>
        </Pressable>
      ))}
    </View>
  )
}
