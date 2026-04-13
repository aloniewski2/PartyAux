'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QueueItem } from '@/lib/supabase/types'

const AUTO_QUEUE_THRESHOLD = 2   // trigger when ≤ this many songs remain
const COOLDOWN_MS = 60_000       // minimum gap between auto-adds (1 min)
const STARTUP_FILL = 3           // songs to seed when queue is completely empty

interface Options {
  roomId: string
  isHost: boolean
  queue: QueueItem[]
  displayName: string
  onAdded: (title: string, artist: string) => void
  onError?: (msg: string) => void
}

export function useAutoQueue({ roomId, isHost, queue, displayName, onAdded, onError }: Options) {
  const lastAddedAt = useRef<number>(0)
  const isRunning = useRef(false)
  const supabase = createClient()

  // Core: pick & insert one song, given what's already in the queue + a local exclusion list
  const pickOneSong = useCallback(async (
    currentQueue: QueueItem[],
    excludeTitles: string[],   // tracks already picked this batch (not yet in DB)
    bypassCooldown = false,
  ): Promise<{ title: string; artist: string } | null> => {
    if (!bypassCooldown && Date.now() - lastAddedAt.current < COOLDOWN_MS) return null

    const { data: history } = await supabase
      .from('queue_items')
      .select('title, artist, vote_count')
      .eq('room_id', roomId)
      .eq('is_played', true)
      .order('created_at', { ascending: false })
      .limit(20)

    const topVoted = [...currentQueue]
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 10)

    // Combine DB queue + locally-picked titles so AI avoids dupes within a batch
    const allExcluded = [
      ...currentQueue.map((q) => q.title),
      ...excludeTitles,
    ]

    const res = await fetch('/api/ai-autopick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queue: allExcluded.map((title) => ({ title, artist: '' })),
        playHistory: (history ?? []).map((h) => ({ title: h.title, artist: h.artist })),
        topVoted: topVoted.map((t) => ({ title: t.title, artist: t.artist, vote_count: t.vote_count })),
      }),
    })

    if (!res.ok) throw new Error('AI endpoint failed')
    const { song } = await res.json()
    if (!song?.title || !song?.artist) throw new Error('No song returned')

    const searchRes = await fetch(
      `/api/spotify/search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`
    )
    const searchData = await searchRes.json()
    const track = searchData.tracks?.[0]
    if (!track) throw new Error(`Spotify couldn't find "${song.title}"`)

    // Skip if already in queue (by Spotify ID)
    const alreadyQueued = currentQueue.some((q) => q.spotify_track_id === track.id)
      || excludeTitles.includes(track.name)
    if (alreadyQueued) return null

    await supabase.from('queue_items').insert({
      room_id: roomId,
      spotify_track_id: track.id,
      title: track.name,
      artist: track.artists.map((a: { name: string }) => a.name).join(', '),
      album_art_url: track.album.images[0]?.url ?? null,
      added_by: `${displayName} (AI Auto)`,
    })

    lastAddedAt.current = Date.now()
    return { title: track.name, artist: track.artists[0]?.name ?? song.artist }
  }, [roomId, displayName, supabase])

  const runAutoPick = useCallback(async (startup = false) => {
    if (!isHost) return
    if (isRunning.current) return
    isRunning.current = true

    try {
      const count = startup ? STARTUP_FILL : 1
      const picked: string[] = []

      for (let i = 0; i < count; i++) {
        const result = await pickOneSong(queue, picked, startup)
        if (result) {
          picked.push(result.title)
          onAdded(result.title, result.artist)
        }
      }
    } catch (err) {
      console.error('useAutoQueue error:', err)
      onError?.('AI auto-queue hit an error')
    } finally {
      isRunning.current = false
    }
  }, [isHost, queue, pickOneSong, onAdded, onError])

  useEffect(() => {
    if (!isHost) return
    if (queue.length === 0) {
      // Party just started — seed the queue with STARTUP_FILL songs
      runAutoPick(true)
    } else if (queue.length <= AUTO_QUEUE_THRESHOLD) {
      // Queue running low — add one more
      runAutoPick(false)
    }
  }, [queue.length, isHost, runAutoPick])
}
