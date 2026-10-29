import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { getAccessToken, refreshAccess, wsUrl } from './api'

type Handler = (data: Record<string, unknown>) => void

/** WebSocket with backoff reconnect; reconnects when the app returns to the foreground. */
export function useSocket(path: string | null, onMessage: Handler) {
  const handler = useRef(onMessage)
  const socket = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    handler.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!path) return
    let closed = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = async () => {
      if (!getAccessToken()) await refreshAccess().catch(() => null)
      if (closed) return
      const ws = new WebSocket(wsUrl(path))
      socket.current = ws
      ws.onopen = () => {
        attempt = 0
        setConnected(true)
      }
      ws.onmessage = (e) => {
        try {
          handler.current(JSON.parse(String(e.data)))
        } catch {
          /* ignore */
        }
      }
      ws.onclose = async (e) => {
        setConnected(false)
        if (closed || e.code === 4404) return
        if (e.code === 4401) await refreshAccess().catch(() => null)
        attempt += 1
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt))
      }
    }
    connect()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && socket.current?.readyState !== WebSocket.OPEN) {
        clearTimeout(timer)
        connect()
      }
    })
    return () => {
      closed = true
      clearTimeout(timer)
      sub.remove()
      socket.current?.close()
    }
  }, [path])

  const send = (data: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(data))
      return true
    }
    return false
  }
  return { send, connected }
}
