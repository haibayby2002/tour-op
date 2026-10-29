import Constants, { ExecutionEnvironment } from 'expo-constants'

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin')

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

/**
 * Google sign-in uses native code that Expo Go doesn't include, so it's only
 * offered in a development/production build, and only when a client ID is set.
 */
export const googleSignInAvailable = !!WEB_CLIENT_ID && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

let module: GoogleSigninModule | null = null
function load(): GoogleSigninModule {
  if (!module) {
    // Required lazily: importing the native module inside Expo Go throws.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('@react-native-google-signin/google-signin') as GoogleSigninModule
    // webClientId makes Google issue the ID token for our backend's (web) client ID.
    module.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID })
  }
  return module
}

/** Shows Google's account picker. Returns the ID token, or null if the user cancelled. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = load()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    // Sign out first so the account picker appears every time.
    await GoogleSignin.signOut().catch(() => undefined)
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return null
    if (!response.data.idToken) throw new Error('Google did not return an ID token.')
    return response.data.idToken
  } catch (error) {
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) return null
    throw error
  }
}
