'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  redirectTo?: string
  className?: string
  children?: React.ReactNode
}

export default function SpotifyLoginButton({
  redirectTo = '/',
  className = '',
  children,
}: Props) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        // Request scopes needed for Web Playback SDK + user info
        scopes: [
          'streaming',
          'user-read-email',
          'user-read-private',
          'user-read-playback-state',
          'user-modify-playback-state',
          'user-read-currently-playing',
        ].join(' '),
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        // PKCE is the default flow in @supabase/ssr — no extra config needed
      },
    })

    if (error) {
      console.error('Spotify OAuth error:', error)
      setLoading(false)
    }
    // On success, browser is redirected — no need to reset loading
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={`flex items-center gap-3 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-60
        text-black font-bold py-3 px-6 rounded-full transition-all duration-200
        active:scale-95 ${className}`}
    >
      {/* Spotify logo SVG */}
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 fill-current"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
      {loading ? 'Connecting…' : (children ?? 'Continue with Spotify')}
    </button>
  )
}
