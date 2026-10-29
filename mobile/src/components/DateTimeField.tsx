import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'

import { dateTime } from '../lib/format'
import { styles, Text } from './ui'

/** Date + time picker that works on both platforms (Android needs two dialogs). */
export default function DateTimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false)

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, withTime) => {
            if (e2.type === 'set' && withTime) onChange(withTime)
          },
        })
      },
    })
  }

  return (
    <View>
      <Pressable style={styles.input} onPress={() => (Platform.OS === 'android' ? openAndroid() : setOpen((o) => !o))}>
        <Text style={{ fontSize: 15 }}>{dateTime(value.toISOString())}</Text>
      </Pressable>
      {open && Platform.OS !== 'android' && (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="inline"
          minimumDate={new Date()}
          onChange={(_, date) => date && onChange(date)}
        />
      )}
    </View>
  )
}
