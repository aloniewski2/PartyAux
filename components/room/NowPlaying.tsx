'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { QueueItem } from '@/lib/supabase/types'
import { formatDuration } from '@/lib/utils'

interface Props {
  currentTrack: QueueItem | null
  isHost: boolean
}

// Extend Window for Spotify SDK types
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, cb: (data: unknown) => void): boolean
  removeListener(event: string, cb?: (data: unknown) => void): boolean
  getCurrentState(): Promise<SpotifyPlayerState | null>
  setName(name: string): Promise<void>
  getVolume(): Promise<number>
  setVolume(volume: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  togglePlay(): Promise<void>
  seek(position_ms: number): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
}

interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      id: string
      name: string
      duration_ms: number
      artists: { name: string }[]
      album: { images: { url: string }[] }
    }
  }
}

export default function NowPlaying({ currentTrack, isHost }: Props) {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null)
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const progressInterval = useRef<ReturnType<typeof setInterval>>(null)

  // Load Spotify Web Playback SDK (host only)
  useEffect(() => {
    if (!isHost) return

    async function initPlayer() {
      const res = await fetch('/api/spotify/token')
      const { access_token } = await res.json()
      if (!access_token) return

      // Load SDK script if not already loaded
      if (!document.getElementById('spotify-sdk')) {
        const script = document.createElement('script')
        script.id = 'spotify-sdk'
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        document.body.appendChild(script)
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        const p = new window.Spotify.Player({
          name: 'partyaux',
          getOAuthToken: (cb) => cb(access_token),
          volume: 0.7,
        })

        p.addListener('ready', (data) => {
          const { device_id } = data as { device_id: string }
          setDeviceId(device_id)
          console.log('Spotify player ready, device_id:', device_id)
        })

        p.addListener('player_state_changed', (state) => {
          setPlayerState(state as SpotifyPlayerState | null)
        })

        p.addListener('initialization_error', (data: unknown) => {
          const d = data as { message: string }
          console.error('Init error:', d.message)
        })
        p.addListener('authentication_error', (data: unknown) => {
          const d = data as { message: string }
          console.error('Auth error:', d.message)
        })
        p.addListener('account_error', (data: unknown) => {
          const d = data as { message: string }
          console.error('Account error — Spotify Premium required for playback:', d.message)
        })

        p.connect()
        setPlayer(p)
      }
    }

    initPlayer()

    return () => {
      if (player) player.disconnect()
    }
  }, [isHost])

  // Progress bar tick
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (!playerState || playerState.paused) return

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 500
        return next >= playerState.duration ? playerState.duration : next
      })
    }, 500)

    setProgress(playerState.position)

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [playerState])

  const track = playerState?.track_window.current_track ?? null
  const displayTrack = track
    ? {
        title: track.name,
        artist: track.artists.map((a) => a.name).join(', '),
        album_art_url: track.album.images[0]?.url ?? null,
        duration: track.duration_ms,
      }
    : currentTrack
    ? {
        title: currentTrack.title,
        artist: currentTrack.artist,
        album_art_url: currentTrack.album_art_url,
        duration: 0,
      }
    : null

  const duration = playerState?.duration ?? 0
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  if (!displayTrack) {
    return (
      <div className="bg-zinc-800/50 rounded-2xl p-6 flex items-center justify-center min-h-[120px]">
        <p className="text-zinc-500 text-sm">Nothing playing yet — add songs to the queue!</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl p-4 border border-zinc-700/50">
      <div className="flex items-center gap-4">
        {/* Album art */}
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-700 shrink-0 shadow-lg">
          {displayTrack.album_art_url ? (
            <Image
              src={displayTrack.album_art_url}
              alt={displayTrack.title}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          {/* Pulse animation when playing */}
          {playerState && !playerState.paused && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-purple-500 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">
              Now Playing
            </span>
          </div>
          <p className="text-white font-bold text-base truncate">{displayTrack.title}</p>
          <p className="text-zinc-400 text-sm truncate">{displayTrack.artist}</p>

          {/* Progress bar */}
          {duration > 0 && (
            <div className="mt-3 space-y-1">
              <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Host controls */}
      {isHost && player && (
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-zinc-700/50">
          <button
            onClick={() => player.previousTrack()}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Previous"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={() => player.togglePlay()}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center
              hover:scale-105 active:scale-95 transition-transform shadow-lg"
            title={playerState?.paused !== false ? 'Play' : 'Pause'}
          >
            {playerState?.paused !== false ? (
              <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => player.nextTrack()}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Next"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Non-host listening indicator */}
      {!isHost && (
        <p className="text-center text-xs text-zinc-600 mt-3">
          Host controls playback · Spotify Premium required
        </p>
      )}
    </div>
  )
}
