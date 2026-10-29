import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { Badge, Button, Card, ErrorText, Input, Notice, Screen, styles, Text } from '../components/ui'
import { api } from '../lib/api'
import { takeDevCodes } from '../lib/devCodes'
import type { Me } from '../lib/types'
import { canBook } from '../lib/verification'

type Kind = 'EMAIL' | 'PHONE'

function VerifyCard({ kind, target, verified, devCode }: { kind: Kind; target: string; verified: boolean; devCode?: string }) {
  const { t } = useTranslation()
  const { setUser } = useAuth()
  const [code, setCode] = useState('')
  const [debug, setDebug] = useState(devCode)
  const [sent, setSent] = useState(!!devCode)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600' }}>{t(kind === 'EMAIL' ? 'verify.email' : 'verify.phone')}</Text>
          <Text style={styles.hint}>{target}</Text>
        </View>
        <Badge tone={verified ? 'green' : 'amber'} label={verified ? `✓ ${t('verify.verified')}` : t('verify.not_verified')} />
      </View>
      {!verified && (
        <>
          {debug ? <Notice tone="blue">{`${t('verify.dev_code')} ${debug}`}</Notice> : null}
          {sent && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input
                style={{ flex: 1, letterSpacing: 4 }}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
              />
              <Button
                title={t('verify.confirm')}
                disabled={code.length !== 6}
                loading={busy}
                onPress={() => run(async () => setUser(await api<Me>('/auth/verify/confirm/', { body: { kind, code } })))}
              />
            </View>
          )}
          <Button
            small
            variant="secondary"
            title={sent ? t('verify.resend') : t('verify.send')}
            onPress={() =>
              run(async () => {
                const res = await api<{ debug_code?: string }>('/auth/verify/send/', { body: { kind } })
                setDebug(res.debug_code)
                setSent(true)
              })
            }
          />
          <ErrorText error={error} />
        </>
      )}
    </Card>
  )
}

export default function VerifyScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useState(takeDevCodes)
  if (!user) return null
  const done = user.email_verified && user.phone_verified
  const enough = canBook(user)
  return (
    <Screen>
      <Text style={styles.hint}>{t('verify.subtitle')}</Text>
      <VerifyCard kind="EMAIL" target={user.email} verified={user.email_verified} devCode={params.EMAIL} />
      <VerifyCard kind="PHONE" target={user.phone ?? ''} verified={user.phone_verified} devCode={params.PHONE} />
      <Text style={styles.hint}>{t('verify.not_identity')}</Text>
      {enough && !done && <Notice tone="green">{t('verify.one_more')}</Notice>}
      <Button title={enough ? t('verify.continue') : t('verify.later')} variant={enough ? 'primary' : 'ghost'} onPress={() => router.replace('/explore')} />
    </Screen>
  )
}
