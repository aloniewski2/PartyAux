'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SpotifyLoginButton from '@/components/auth/SpotifyLoginButton'
import { generateJoinCode } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  // Create room state
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)

  // Join room state
  const [joinCode, setJoinCode] = useState('')
  const [guestName, setGuestName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoadingUser(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !roomName.trim()) return

    setCreating(true)
    const code = generateJoinCode()

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        join_code: code,
        name: roomName.trim(),
        host_id: user.id,
      })
      .select()
      .single()

    if (error || !room) {
      console.error('Create room error:', JSON.stringify(error), error?.message, error?.code, error?.details, error?.hint)
      setCreating(false)
      return
    }

    // Add host to room_users
    await supabase.from('room_users').insert({
      room_id: room.id,
      user_id: user.id,
      display_name: user.user_metadata?.full_name ?? user.email ?? 'Host',
    })

    router.push(`/room/${room.join_code}`)
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault()
    setJoinError('')

    const code = joinCode.trim().toUpperCase()
    const name = guestName.trim() || (user?.user_metadata?.full_name ?? 'Guest')

    if (!code) { setJoinError('Enter a room code'); return }
    if (!name) { setJoinError('Enter your display name'); return }

    setJoining(true)

    // Look up room
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('join_code', code)
      .eq('is_active', true)
      .single()

    if (error || !room) {
      setJoinError('Room not found or no longer active')
      setJoining(false)
      return
    }

    // Register as a room user
    await supabase.from('room_users').insert({
      room_id: room.id,
      user_id: user?.id ?? null,
      display_name: name,
    })

    router.push(`/room/${room.join_code}?name=${encodeURIComponent(name)}`)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg shadow-purple-600/30">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white">partyaux</h1>
          <p className="text-zinc-400 text-base">
            Collaborative party playlists powered by votes
          </p>
        </div>

        {/* Auth status */}
        {user ? (
          <div className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  {user.user_metadata?.full_name ?? user.email}
                </p>
                <p className="text-zinc-500 text-xs">Spotify connected</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
            <p className="text-zinc-400 text-sm text-center">
              Connect Spotify to host a room and control playback
            </p>
            <SpotifyLoginButton className="w-full justify-center" />
          </div>
        )}

        {/* Create Room (requires Spotify auth) */}
        {user && (
          <form onSubmit={handleCreateRoom} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Create a Room</h2>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name (e.g. Friday Night Vibes)"
              maxLength={50}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white
                placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!roomName.trim() || creating}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50
                disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all
                flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                '🎉 Create Room'
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-sm">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Join Room (anyone can join) */}
        <form onSubmit={handleJoinRoom} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-bold text-lg">Join a Room</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code (e.g. AUX-4821)"
            maxLength={10}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white
              placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors text-sm
              font-mono tracking-wider uppercase"
          />
          {!user && (
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your display name"
              maxLength={30}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white
                placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors text-sm"
            />
          )}
          {joinError && (
            <p className="text-red-400 text-sm">{joinError}</p>
          )}
          <button
            type="submit"
            disabled={!joinCode.trim() || joining}
            className="w-full py-3 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50
              disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all
              flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {joining ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Joining…
              </>
            ) : (
              '→ Join Room'
            )}
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs">
          No Spotify account? Join as a guest to vote and add songs.
          <br />
          Host needs Spotify Premium for playback controls.
        </p>
      </div>
    </main>
  )
}
