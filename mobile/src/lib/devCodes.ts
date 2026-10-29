/** Verification codes returned by the API in development, handed from Register to Verify. */
let pending: Partial<Record<'EMAIL' | 'PHONE', string>> = {}

export const setDevCodes = (codes?: Partial<Record<'EMAIL' | 'PHONE', string>>) => {
  pending = codes ?? {}
}
export const takeDevCodes = () => pending
