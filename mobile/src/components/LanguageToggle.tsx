import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { changeLanguage } from '../i18n'
import { colors, Text } from './ui'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('en') ? 'en' : 'vi'
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 2, backgroundColor: colors.surface }}>
      {(['vi', 'en'] as const).map((lng) => (
        <Pressable
          key={lng}
          onPress={() => changeLanguage(lng)}
          style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: current === lng ? colors.brand : 'transparent' }}
          accessibilityState={{ selected: current === lng }}
        >
          <Text style={{ fontWeight: '700', fontSize: 12, color: current === lng ? colors.onBrand : colors.muted }}>{lng.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}
