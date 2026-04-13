'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Room, QueueItem } from '@/lib/supabase/types'
import type { User } from '@supabase/supabase-js'
import NowPlaying from '@/components/room/NowPlaying'
import QueueList from '@/components/room/QueueList'
import SearchBar from '@/components/room/SearchBar'
import UserPresence from '@/components/room/UserPresence'
import AIPickModal from '@/components/room/AIPickModal'
import { Toast, useToast } from '@/components/ui/Toast'
import { copyToClipboard } from '@/lib/utils'
import { useAutoQueue } from '@/hooks/useAutoQueue'

interface PageProps {
  params: Promise<{ code: string }>
}

export default function RoomPage({ params }: PageProps) {
  const { code } = use(params)
  const searchParams = useSearchParams()
  const guestName = searchParams.get('name')
  const router = useRouter()
  const supabase = createClient()
  const { toast, show, dismiss } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    async function init() {
      // Get current user (may be null for guests)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Fetch room by join code
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('join_code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !roomData) {
        router.replace('/?error=room_not_found')
        return
      }

      setRoom(roomData)

      // Determine display name
      const name = guestName
        ?? currentUser?.user_metadata?.full_name
        ?? currentUser?.email
        ?? 'Guest'
      setDisplayName(name)

      // Initial queue fetch
      const { data: queueData } = await supabase
        .from('queue_items')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('is_played', false)
        .order('pinned', { ascending: false })
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: true })

      setQueue(queueData ?? [])
      setLoading(false)
    }

    init()
  }, [code, guestName])

  // Listen for queue changes to keep local state fresh (for AI modal)
  useEffect(() => {
    if (!room) return

    const channel = supabase
      .channel(`room-queue-shadow:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data } = await supabase
            .from('queue_items')
            .select('*')
            .eq('room_id', room.id)
            .eq('is_played', false)
            .order('vote_count', { ascending: false })
          setQueue(data ?? [])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room?.id])

  async function handleCopyCode() {
    if (!room) return
    const ok = await copyToClipboard(room.join_code)
    show(ok ? `Copied ${room.join_code}!` : 'Could not copy', ok ? 'success' : 'error')
  }

  async function handleLeave() {
    if (room && user) {
      await supabase
        .from('room_users')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id)
    }
    router.replace('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm">Loading room…</p>
        </div>
      </div>
    )
  }

  if (!room) return null

  const isHost = !!user && user.id === room.host_id
  const currentTrack = queue[0] ?? null

  // Auto-add a song when the queue runs low (host only)
  useAutoQueue({
    roomId: room.id,
    isHost,
    queue,
    displayName,
    onAdded: (title, artist) => show(`AI added "${title}" by ${artist}`, 'success'),
    onError: (msg) => show(msg, 'error'),
  })

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 max-w-2xl mx-auto">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back */}
            <button
              onClick={handleLeave}
              className="text-zinc-500 hover:text-white transition-colors shrink-0"
              title="Leave room"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="min-w-0">
              <h1 className="text-white font-bold text-base truncate leading-tight">{room.name}</h1>
              <button
                onClick={handleCopyCode}
                className="text-zinc-500 hover:text-purple-400 text-xs font-mono transition-colors flex items-center gap-1"
              >
                {room.join_code}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Live presence */}
          <UserPresence roomId={room.id} />
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
        {/* Now Playing */}
        <NowPlaying currentTrack={currentTrack} isHost={isHost} />

        {/* Queue */}
        <QueueList
          roomId={room.id}
          hostId={room.host_id}
          currentUserId={user?.id ?? null}
          displayName={displayName}
        />
      </main>

      {/* ── Bottom search bar ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl
        bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/50 px-4 py-3">
        <SearchBar roomId={room.id} displayName={displayName} />
      </div>

      {/* ── AI Pick floating button ── */}
      <button
        onClick={() => setAiOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3
          bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full shadow-lg
          shadow-purple-600/30 transition-all active:scale-95 hover:scale-105"
      >
        <span className="text-base">✨</span>
        <span className="text-sm">AI Pick</span>
      </button>

      {/* ── AI Pick Modal ── */}
      <AIPickModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        roomId={room.id}
        queue={queue}
        displayName={displayName}
      />

      {/* ── Toast notifications ── */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />
      )}
    </div>
  )
}
