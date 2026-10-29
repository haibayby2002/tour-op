import { Image, View } from 'react-native'

import { colors, Text } from './ui'

/** The Tour-op mark and name, the same as the web app's header. */
export default function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28 }} accessibilityIgnoresInvertColors />
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.brandDark, letterSpacing: -0.3 }}>Tour-op</Text>
    </View>
  )
}
