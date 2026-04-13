'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { QueueItem } from '@/lib/supabase/types'
import type { AISuggestion } from '@/app/api/ai-suggestions/route'
import { createClient } from '@/lib/supabase/client'

const VIBE_TAGS = [
  { id: 'hype', label: '🔥 Hype', desc: 'High energy bangers' },
  { id: 'chill', label: '😌 Chill', desc: 'Laid-back vibes' },
  { id: 'throwbacks', label: '⏮️ Throwbacks', desc: 'Classic hits' },
  { id: 'rap', label: '🎤 Rap/Hip-Hop', desc: 'Beats and bars' },
  { id: 'indie', label: '🎸 Indie', desc: 'Alternative & indie' },
  { id: 'pop', label: '✨ Pop', desc: 'Chart-toppers' },
  { id: 'rnb', label: '🎷 R&B/Soul', desc: 'Smooth and soulful' },
  { id: 'edm', label: '🎧 EDM', desc: 'Electronic & dance' },
  { id: 'latin', label: '💃 Latin', desc: 'Reggaeton & latin pop' },
  { id: 'rock', label: '🤘 Rock', desc: 'Guitar-driven energy' },
]

interface Props {
  open: boolean
  onClose: () => void
  roomId: string
  queue: QueueItem[]
  displayName: string
}

export default function AIPickModal({ open, onClose, roomId, queue, displayName }: Props) {
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const supabase = createClient()

  function toggleVibe(id: string) {
    setSelectedVibes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  async function fetchSuggestions() {
    if (selectedVibes.length === 0) return
    setLoading(true)
    setSuggestions([])
    setWarning(null)

    try {
      const res = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue: queue.map((q) => ({ title: q.title, artist: q.artist })),
          vibes: selectedVibes,
        }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      if (data.warning) setWarning(data.warning)
    } catch {
      setWarning('Could not reach AI service — showing fallback picks.')
    } finally {
      setLoading(false)
    }
  }

  async function addSuggestion(suggestion: AISuggestion) {
    const key = `${suggestion.title}-${suggestion.artist}`
    if (added.has(key)) return
    setAdding(key)

    // Search Spotify for the track
    const searchRes = await fetch(
      `/api/spotify/search?q=${encodeURIComponent(`${suggestion.title} ${suggestion.artist}`)}`
    )
    const searchData = await searchRes.json()
    const track = searchData.tracks?.[0]

    if (track) {
      await supabase.from('queue_items').insert({
        room_id: roomId,
        spotify_track_id: track.id,
        title: track.name,
        artist: track.artists.map((a: { name: string }) => a.name).join(', '),
        album_art_url: track.album.images[0]?.url ?? null,
        added_by: `${displayName} (AI Pick)`,
      })
      setAdded((prev) => new Set([...prev, key]))
    }

    setAdding(null)
  }

  function handleClose() {
    setSuggestions([])
    setSelectedVibes([])
    setWarning(null)
    setAdded(new Set())
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="AI Pick ✨">
      {suggestions.length === 0 ? (
        <div className="space-y-5">
          <p className="text-zinc-400 text-sm">
            Pick your vibe and Gemini AI will suggest 5 songs that fit your party.
          </p>

          {/* Vibe tags */}
          <div className="grid grid-cols-2 gap-2">
            {VIBE_TAGS.map((vibe) => {
              const active = selectedVibes.includes(vibe.id)
              return (
                <button
                  key={vibe.id}
                  onClick={() => toggleVibe(vibe.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all
                    ${active
                      ? 'border-purple-500 bg-purple-900/30 text-white'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                    }`}
                >
                  <span className="text-sm font-medium">{vibe.label}</span>
                  <span className="text-xs text-zinc-500 mt-0.5">{vibe.desc}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={fetchSuggestions}
            disabled={selectedVibes.length === 0 || loading}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50
              disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Asking Gemini…
              </>
            ) : (
              <>✨ Get AI Suggestions</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {warning && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2">
              <p className="text-yellow-400 text-xs">{warning}</p>
            </div>
          )}

          <div className="space-y-3">
            {suggestions.map((s) => {
              const key = `${s.title}-${s.artist}`
              const isAdded = added.has(key)
              return (
                <div key={key} className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{s.title}</p>
                      <p className="text-zinc-400 text-xs">{s.artist}</p>
                      <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">{s.reason}</p>
                    </div>
                    <button
                      onClick={() => addSuggestion(s)}
                      disabled={isAdded || adding === key}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                        ${isAdded
                          ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                          : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                        } ${adding === key ? 'opacity-50' : ''}`}
                    >
                      {isAdded ? '✓ Added' : adding === key ? '…' : '+ Add'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => { setSuggestions([]); setAdded(new Set()) }}
            className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Change vibes
          </button>
        </div>
      )}
    </Modal>
  )
}
