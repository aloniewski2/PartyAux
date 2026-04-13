'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoomUser } from '@/lib/supabase/types'

interface Props {
  roomId: string
}

// Deterministic color from a string
function stringToColor(str: string): string {
  const colors = [
    '#7C3AED', '#DB2777', '#EA580C', '#16A34A',
    '#0284C7', '#DC2626', '#9333EA', '#0D9488',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      title={name}
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
        ring-2 ring-zinc-900 -ml-2 first:ml-0 transition-all"
      style={{ backgroundColor: stringToColor(name) }}
    >
      {initials}
    </div>
  )
}

export default function UserPresence({ roomId }: Props) {
  const [users, setUsers] = useState<RoomUser[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    supabase
      .from('room_users')
      .select('*')
      .eq('room_id', roomId)
      .then(({ data }) => {
        if (data) setUsers(data)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`presence:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${roomId}` },
        () => {
          // Refetch on any change
          supabase
            .from('room_users')
            .select('*')
            .eq('room_id', roomId)
            .then(({ data }) => {
              if (data) setUsers(data)
            })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  const visible = users.slice(0, 6)
  const overflow = users.length - visible.length

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {visible.map((u) => (
          <Avatar key={u.id} name={u.display_name} />
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center
            text-xs font-bold text-zinc-300 ring-2 ring-zinc-900 -ml-2">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-zinc-500 ml-1">{users.length}</span>
    </div>
  )
}
