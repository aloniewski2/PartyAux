'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { SpotifyTrack } from '@/lib/spotify/api'
import { formatTrack } from '@/lib/spotify/api'
import { createClient } from '@/lib/supabase/client'
import { getGuestIdentifier } from '@/lib/utils'

interface Props {
  roomId: string
  displayName: string
}

export default function SearchBar({ roomId, displayName }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const supabase = createClient()

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.tracks ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setOpen(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  async function handleAdd(track: SpotifyTrack) {
    setAdding(track.id)
    const formatted = formatTrack(track)

    const guestId = getGuestIdentifier()

    const { error } = await supabase.from('queue_items').insert({
      room_id: roomId,
      spotify_track_id: formatted.spotify_track_id,
      title: formatted.title,
      artist: formatted.artist,
      album_art_url: formatted.album_art_url,
      added_by: displayName,
    })

    if (!error) {
      setQuery('')
      setResults([])
      setOpen(false)
    } else {
      console.error('Add to queue error:', error)
    }
    setAdding(null)
  }

  return (
    <div className="relative">
      {/* Search input */}
      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
        focus-within:border-purple-500 transition-colors">
        <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search for a song to add…"
          className="bg-transparent flex-1 text-white placeholder-zinc-500 outline-none text-sm"
        />
        {searching && (
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-purple-400 rounded-full animate-spin shrink-0" />
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-zinc-900 border border-zinc-700
          rounded-xl shadow-2xl overflow-hidden z-40 max-h-72 overflow-y-auto">
          {results.map((track) => (
            <button
              key={track.id}
              onMouseDown={() => handleAdd(track)}
              disabled={adding === track.id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors
                disabled:opacity-50 text-left"
            >
              {track.album.images[0] && (
                <Image
                  src={track.album.images[0].url}
                  alt={track.album.name}
                  width={40}
                  height={40}
                  className="rounded-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{track.name}</p>
                <p className="text-zinc-400 text-xs truncate">
                  {track.artists.map((a) => a.name).join(', ')} · {track.album.name}
                </p>
              </div>
              {adding === track.id ? (
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-purple-400 rounded-full animate-spin shrink-0" />
              ) : (
                <svg className="w-5 h-5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
