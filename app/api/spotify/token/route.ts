/**
 * Returns a fresh Spotify client-credentials token.
 * Used by the host's browser to initialise the Web Playback SDK
 * when their Supabase session already has the user OAuth token,
 * but we also need the SDK token separately.
 *
 * NOTE: The SDK actually requires the USER's OAuth access token
 * (obtained via Supabase Auth Spotify provider), not a client-credentials
 * token. This route serves as a helper for the host to exchange their
 * Supabase session into a usable Spotify access token.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const providerToken = session.provider_token
    if (!providerToken) {
      return NextResponse.json(
        { error: 'No Spotify provider token — please re-login with Spotify' },
        { status: 401 }
      )
    }

    return NextResponse.json({ access_token: providerToken })
  } catch (err) {
    console.error('Token route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
