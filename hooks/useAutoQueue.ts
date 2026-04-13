'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QueueItem } from '@/lib/supabase/types'

const AUTO_QUEUE_THRESHOLD = 2   // trigger when ≤ this many songs remain
const COOLDOWN_MS = 60_000       // minimum gap between auto-adds (1 min)

interface Options {
  roomId: string
  isHost: boolean
  queue: QueueItem[]             // unplayed items
  displayName: string
  onAdded: (title: string, artist: string) => void
  onError?: (msg: string) => void
}

export function useAutoQueue({ roomId, isHost, queue, displayName, onAdded, onError }: Options) {
  const lastAddedAt = useRef<number>(0)
  const isRunning = useRef(false)
  const supabase = createClient()

  const runAutoPick = useCallback(async () => {
    if (!isHost) return
    if (isRunning.current) return
    if (Date.now() - lastAddedAt.current < COOLDOWN_MS) return

    isRunning.current = true

    try {
      // Fetch play history for this room (most recent 20 played songs)
      const { data: history } = await supabase
        .from('queue_items')
        .select('title, artist, vote_count')
        .eq('room_id', roomId)
        .eq('is_played', true)
        .order('created_at', { ascending: false })
        .limit(20)

      // Top voted from current queue for taste signal
      const topVoted = [...queue]
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 10)

      // Ask AI for the best next song
      const res = await fetch('/api/ai-autopick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue: queue.map((q) => ({ title: q.title, artist: q.artist })),
          playHistory: (history ?? []).map((h) => ({ title: h.title, artist: h.artist })),
          topVoted: topVoted.map((t) => ({ title: t.title, artist: t.artist, vote_count: t.vote_count })),
        }),
      })

      if (!res.ok) throw new Error('AI endpoint failed')

      const { song } = await res.json()
      if (!song?.title || !song?.artist) throw new Error('No song returned')

      // Search Spotify for the track
      const searchRes = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`
      )
      const searchData = await searchRes.json()
      const track = searchData.tracks?.[0]

      if (!track) throw new Error(`Spotify couldn't find "${song.title}"`)

      // Avoid adding duplicates already in queue
      const alreadyQueued = queue.some(
        (q) => q.spotify_track_id === track.id
      )
      if (alreadyQueued) {
        isRunning.current = false
        return
      }

      await supabase.from('queue_items').insert({
        room_id: roomId,
        spotify_track_id: track.id,
        title: track.name,
        artist: track.artists.map((a: { name: string }) => a.name).join(', '),
        album_art_url: track.album.images[0]?.url ?? null,
        added_by: `${displayName} (AI Auto)`,
      })

      lastAddedAt.current = Date.now()
      onAdded(track.name, track.artists[0]?.name ?? song.artist)
    } catch (err) {
      console.error('useAutoQueue error:', err)
      onError?.('AI auto-queue hit an error')
    } finally {
      isRunning.current = false
    }
  }, [isHost, roomId, queue, displayName, onAdded, onError])

  useEffect(() => {
    if (!isHost) return
    if (queue.length <= AUTO_QUEUE_THRESHOLD) {
      runAutoPick()
    }
  }, [queue.length, isHost, runAutoPick])
}
