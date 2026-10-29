import { useState, type ReactNode } from 'react'
import { FlatList, Image, Modal, Pressable, ScrollView, StatusBar, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { colors, Text } from './ui'

export interface ViewablePhoto {
  id: number
  image: string
  thumbnail?: string | null
  caption?: string
}

/** Horizontal row of thumbnails; tapping one opens the full-screen viewer. */
export function PhotoStrip({
  photos,
  size = 140,
  overlay,
}: {
  photos: ViewablePhoto[]
  size?: number
  overlay?: (photo: ViewablePhoto) => ReactNode
}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingTop: overlay ? 6 : 0 }} showsHorizontalScrollIndicator={false}>
        {photos.map((p, i) => (
          <View key={p.id}>
            <Pressable onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={p.caption || undefined}>
              <Image source={{ uri: p.thumbnail || p.image }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.border }} />
            </Pressable>
            {overlay?.(p)}
          </View>
        ))}
      </ScrollView>
      <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </>
  )
}

/** Full-screen, swipeable photo viewer. `index === null` means closed. */
export function PhotoViewer({ photos, index, onClose }: { photos: ViewablePhoto[]; index: number | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState(0)
  const visible = index !== null && photos.length > 0
  const shown = photos[current]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(index ?? 0)} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: 'rgba(12,10,9,0.97)' }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {photos.length > 1 ? t('photos.counter', { current: current + 1, total: photos.length }) : ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Text style={{ color: '#fff', fontSize: 26 }}>✕</Text>
          </Pressable>
        </View>
        {visible && (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={index ?? 0}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(p) => String(p.id)}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <View style={{ width, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item.image }} style={{ width, height: height * 0.75 }} resizeMode="contain" />
              </View>
            )}
          />
        )}
        <Text style={{ color: '#fff', textAlign: 'center', padding: 16, paddingBottom: insets.bottom + 16, minHeight: 56 }}>
          {shown?.caption ?? ''}
        </Text>
      </View>
    </Modal>
  )
}
