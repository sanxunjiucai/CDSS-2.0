import { useEffect } from 'react'
import { useAppStore } from '../store'
import './Toast.css'

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useAppStore()

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastItem key={t.id} id={t.id} message={t.message} type={t.type} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

function ToastItem({ id, message, type, onDismiss }: {
  id: number; message: string; type: string; onDismiss: (id: number) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 3200)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{ICONS[type] ?? 'ℹ'}</span>
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={() => onDismiss(id)}>✕</button>
    </div>
  )
}
