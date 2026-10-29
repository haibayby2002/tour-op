import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Button, Chip, ErrorText, Field, Input, Notice, Screen, styles, Text } from '../components/ui'
import { api, filePart } from '../lib/api'
import { useMeta } from '../lib/queries'
import type { Report } from '../lib/types'

/**
 * Private report. Params: reported_user | booking | message | review | tour_request,
 * optional category, dispute=1 to offer opening a dispute, block=1 to offer blocking.
 */
export default function ReportScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<Record<string, string>>()
  const { data: meta } = useMeta()
  const queryClient = useQueryClient()
  const [category, setCategory] = useState(params.category ?? '')
  const [description, setDescription] = useState('')
  const [dispute, setDispute] = useState(false)
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [done, setDone] = useState(false)

  const target = Object.fromEntries(
    ['reported_user', 'booking', 'message', 'review', 'tour_request'].filter((k) => params[k]).map((k) => [k, Number(params[k])]),
  )

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.7 })
    if (!result.canceled) setPhotos((p) => [...p, ...result.assets].slice(0, 10))
  }

  const submit = useMutation({
    mutationFn: async () => {
      const report = await api<Report>('/reports/', { body: { ...target, category, description, open_dispute: dispute } })
      for (const [i, photo] of photos.entries()) {
        const form = new FormData()
        form.append('file', filePart(photo.uri, photo.fileName ?? `evidence-${i}.jpg`, photo.mimeType ?? 'image/jpeg'))
        await api(`/reports/${report.id}/evidence/`, { form })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setDone(true)
    },
  })
  const block = useMutation({
    mutationFn: () => api('/blocks/', { body: { user_id: Number(params.reported_user) } }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      router.replace('/explore')
    },
  })

  if (done) {
    return (
      <Screen>
        <Notice tone="green" title={t('report.sent_title')}>{t('report.sent_body')}</Notice>
        <Button title={t('common.close')} onPress={() => router.back()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <Text style={styles.hint}>{t('report.private_note')}</Text>
      <Field label={t('report.category')}>
        <View style={styles.wrap}>
          {meta?.report_categories.map((c) => (
            <Chip key={c} label={t(`report.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </Field>
      {category === 'SAFETY' && <Notice tone="red">{t('report.emergency')}</Notice>}
      <Field label={t('report.description')}>
        <Input multiline value={description} onChangeText={setDescription} />
      </Field>
      <Field label={t('report.evidence')} hint={t('report.evidence_hint')}>
        <View style={styles.wrap}>
          {photos.map((p) => <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />)}
        </View>
        <Button small variant="secondary" title={t('mobile.choose_photo')} onPress={pick} />
      </Field>
      {params.dispute === '1' && (
        <Pressable onPress={() => setDispute((d) => !d)} accessibilityRole="checkbox" accessibilityState={{ checked: dispute }}>
          <Text style={styles.body}>{dispute ? '☑' : '☐'} {t('report.open_dispute')}</Text>
          <Text style={styles.hint}>{t('report.open_dispute_hint')}</Text>
        </Pressable>
      )}
      <ErrorText error={submit.error} />
      <Button title={t('report.submit')} variant="danger" disabled={!category || !description.trim()} loading={submit.isPending} onPress={() => submit.mutate()} />
      {params.block === '1' && params.reported_user && (
        <>
          <Text style={styles.hint}>{t('block.confirm_body')}</Text>
          <Button title={t('block.button')} variant="secondary" onPress={() => block.mutate()} loading={block.isPending} />
          <ErrorText error={block.error} />
        </>
      )}
    </Screen>
  )
}
