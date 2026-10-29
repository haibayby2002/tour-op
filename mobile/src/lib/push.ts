import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

import { api } from './api'

type NotificationsModule = typeof import('expo-notifications')

// Expo Go on Android throws as soon as expo-notifications is imported (remote push
// was removed from Expo Go in SDK 53), so only load it in development/production builds.
const pushSupported = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: NotificationsModule | null = pushSupported ? require('expo-notifications') : null

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
})

/**
 * Registers this device for Expo push notifications and sends the token to the API.
 * Returns false when permission is denied or push isn't available (simulator, Expo Go, no EAS project).
 */
export async function registerForPush(): Promise<boolean> {
  if (!Notifications || !Device.isDevice) return false
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Tour-op',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return false

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return false // configure an EAS project to enable remote push
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await api('/devices/', { body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } })
    return true
  } catch {
    return false
  }
}
