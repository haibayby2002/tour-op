// Extends app.json. google-services.json (Firebase, for Android push) is git-ignored, so EAS
// cloud builds get it from the GOOGLE_SERVICES_JSON file variable; local builds use the file.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
})
