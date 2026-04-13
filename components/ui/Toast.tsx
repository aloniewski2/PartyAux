'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onDismiss: () => void
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colours = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-zinc-700 text-white',
  }

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full
        text-sm font-medium shadow-xl pointer-events-none
        animate-in slide-in-from-bottom-2 duration-200 ${colours[type]}`}
    >
      {message}
    </div>
  )
}

// Simple hook for toast state management
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  function show(message: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ message, type })
  }

  function dismiss() {
    setToast(null)
  }

  return { toast, show, dismiss }
}
