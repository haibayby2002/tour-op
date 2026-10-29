import { useEffect, useRef, useState } from 'react'

import { getAccessToken, refreshAccess, wsUrl } from './api'

type Handler = (data: Record<string, unknown>) => void

/**
 * Keeps a WebSocket open to `path` with exponential-backoff reconnects.
 * Returns a `send` function and the connection state.
 */
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
      ws.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data))
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = async (event) => {
        setConnected(false)
        if (closed || event.code === 4404) return
        if (event.code === 4401) await refreshAccess().catch(() => null)
        attempt += 1
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt))
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(timer)
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
