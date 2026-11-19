import { useEffect, useState, type ReactNode } from 'react'
import { OfflinePage } from '../../pages/errors/OfflinePage'

/** 인터넷이 끊기면 안내 화면을, 연결되어 있으면 children 을 보여준다 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online ? <>{children}</> : <OfflinePage />
}
