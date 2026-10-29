import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  type TextProps,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../lib/api'

const light = {
  brand: '#0F766E',
  brandDark: '#115E59',
  brandLight: '#F0FDFA',
  brandBorder: '#99F6E4',
  avatarBg: '#CCFBF1',
  onBrand: '#FFFFFF',
  text: '#1C1917',
  label: '#44403C',
  muted: '#78716C',
  border: '#E7E5E4',
  inputBorder: '#D6D3D1',
  subtle: '#F5F5F4',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  danger: '#DC2626',
  red: '#DC2626',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
  amber: '#B45309',
  amberLight: '#FFFBEB',
  green: '#047857',
  greenLight: '#ECFDF5',
  blue: '#0369A1',
  blueLight: '#F0F9FF',
  star: '#F59E0B',
  starOff: '#D6D3D1',
}

const dark: typeof light = {
  brand: '#0D9488',
  brandDark: '#5EEAD4',
  brandLight: '#042F2E',
  brandBorder: '#115E59',
  avatarBg: '#134E4A',
  onBrand: '#FFFFFF',
  text: '#F5F5F4',
  label: '#D6D3D1',
  muted: '#A8A29E',
  border: '#292524',
  inputBorder: '#44403C',
  subtle: '#292524',
  bg: '#0C0A09',
  surface: '#1C1917',
  danger: '#DC2626',
  red: '#F87171',
  redLight: '#450A0A',
  redBorder: '#7F1D1D',
  amber: '#FBBF24',
  amberLight: '#451A03',
  green: '#34D399',
  greenLight: '#022C22',
  blue: '#38BDF8',
  blueLight: '#082F49',
  star: '#F59E0B',
  starOff: '#44403C',
}

export type ColorScheme = 'light' | 'dark'
let scheme: ColorScheme = 'light'

/** Called by the root layout. The tree under it is remounted on change, so everything reads the new palette. */
export function setColorScheme(next: ColorScheme) {
  scheme = next
}

/** The active palette. Read colours at render time (not at module load) so they follow the system theme. */
export const colors = new Proxy(light, {
  get: (_target, key: keyof typeof light) => (scheme === 'dark' ? dark : light)[key],
})

/** Text that defaults to the theme's text colour (React Native's own default is always black). */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ color: colors.text }, style]} />
}

export function Screen({
  children,
  scroll = true,
  refreshControl,
  padded = true,
}: {
  children: ReactNode
  scroll?: boolean
  refreshControl?: React.ReactElement<RefreshControlProps>
  padded?: boolean
}) {
  if (!scroll) return <View style={[styles.screen, padded && styles.padded]}>{children}</View>
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[padded && styles.padded, { gap: 12, paddingBottom: 40 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const v = buttonVariants[variant]
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.text} /> : <RNText style={[styles.buttonText, small && { fontSize: 13 }, { color: v.text }]}>{title}</RNText>}
    </Pressable>
  )
}

const buttonVariants: Record<Variant, { bg: string; text: string; border: string }> = {
  get primary() { return { bg: colors.brand, text: colors.onBrand, border: colors.brand } },
  get secondary() { return { bg: colors.surface, text: colors.text, border: colors.border } },
  get ghost() { return { bg: 'transparent', text: colors.brandDark, border: 'transparent' } },
  get danger() { return { bg: colors.danger, text: colors.onBrand, border: colors.danger } },
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <RNText style={styles.label}>{label}</RNText>
      {children}
      {error ? <RNText style={styles.error}>{error}</RNText> : hint ? <RNText style={styles.hint}>{hint}</RNText> : null}
    </View>
  )
}

export function Input(props: TextInputProps & { multiline?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
    />
  )
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{children}</View>
}

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue'
const tones: Record<Tone, { bg: string; fg: string }> = {
  get neutral() { return { bg: colors.subtle, fg: colors.label } },
  get brand() { return { bg: colors.brandLight, fg: colors.brandDark } },
  get green() { return { bg: colors.greenLight, fg: colors.green } },
  get amber() { return { bg: colors.amberLight, fg: colors.amber } },
  get red() { return { bg: colors.redLight, fg: colors.red } },
  get blue() { return { bg: colors.blueLight, fg: colors.blue } },
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <RNText style={[styles.badgeText, { color: tones[tone].fg }]}>{label}</RNText>
    </View>
  )
}

export function Notice({ tone = 'amber', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <View style={[styles.notice, { backgroundColor: tones[tone].bg }]}>
      {title ? <RNText style={[styles.noticeTitle, { color: tones[tone].fg }]}>{title}</RNText> : null}
      {typeof children === 'string' ? <RNText style={{ color: tones[tone].fg, fontSize: 13 }}>{children}</RNText> : children}
    </View>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  let message = t('errors.generic')
  if (error instanceof ApiError) {
    const key = error.code ? `errors.${error.code}` : ''
    message = key && t(key, { defaultValue: '' }) ? t(key) : error.firstMessage
  } else if (error instanceof Error) {
    // Client-side errors (e.g. ImageUploadError) may carry a translatable code.
    const code = (error as { code?: unknown }).code
    const key = typeof code === 'string' ? `errors.${code}` : ''
    message = key && t(key, { defaultValue: '' }) ? t(key) : error.message
  }
  return <Notice tone="red">{message}</Notice>
}

export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(-2).join('').toUpperCase()
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.avatarBg, alignItems: 'center', justifyContent: 'center' }}>
      <RNText style={{ color: colors.brandDark, fontWeight: '700', fontSize: size / 3 }}>{initials}</RNText>
    </View>
  )
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <RNText style={{ fontSize: size, color: colors.star }}>
      {[1, 2, 3, 4, 5].map((i) => (i <= Math.round(value) ? '★' : '☆')).join('')}
    </RNText>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} accessibilityRole="button" accessibilityLabel={`${i}`}>
          <RNText style={{ fontSize: 34, color: i <= value ? colors.star : colors.starOff }}>★</RNText>
        </Pressable>
      ))}
    </View>
  )
}

export function Loading() {
  return (
    <View style={{ flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <RNText style={{ fontWeight: '600', fontSize: 15, textAlign: 'center', color: colors.text }}>{title}</RNText>
      {typeof children === 'string' ? <RNText style={[styles.hint, { textAlign: 'center' }]}>{children}</RNText> : children}
    </Card>
  )
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: colors.brandLight, borderColor: colors.brand } : null]}
      accessibilityState={{ selected }}
    >
      <RNText style={{ fontSize: 13, color: selected ? colors.brandDark : colors.text }}>{label}</RNText>
    </Pressable>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 2 }}>
      <RNText style={styles.hint}>{label}</RNText>
      {typeof value === 'string' ? <RNText style={styles.body}>{value}</RNText> : value}
    </View>
  )
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <RNText style={[{ fontSize: 22, fontWeight: '700', color: colors.text }, style]}>{children}</RNText>
}

export function H2({ children }: { children: ReactNode }) {
  return <RNText style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 4 }}>{children}</RNText>
}

// Colour-dependent entries are getters so they pick up the active palette; the rest stay static.
const staticStyles = StyleSheet.create({
  padded: { padding: 16 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  buttonText: { fontWeight: '600', fontSize: 15 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  notice: { borderRadius: 12, padding: 12, gap: 4 },
  noticeTitle: { fontWeight: '700', fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
})

export const styles = {
  ...staticStyles,
  get screen(): ViewStyle { return { flex: 1, backgroundColor: colors.bg } },
  get label(): TextStyle { return { fontSize: 14, fontWeight: '500', color: colors.label } },
  get hint(): TextStyle { return { fontSize: 12, color: colors.muted } },
  get error(): TextStyle { return { fontSize: 12, color: colors.red } },
  get body(): TextStyle { return { fontSize: 14, color: colors.text, lineHeight: 20 } },
  get input(): ViewStyle & TextStyle { return { borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text } },
  get card(): ViewStyle { return { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 } },
  get chip(): ViewStyle { return { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface } },
}
