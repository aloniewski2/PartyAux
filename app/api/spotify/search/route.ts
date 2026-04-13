import { NextResponse } from 'next/server'
import { getSpotifyClientToken, searchSpotifyTracks } from '@/lib/spotify/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const token = await getSpotifyClientToken()
    const tracks = await searchSpotifyTracks(query.trim(), token)
    return NextResponse.json({ tracks })
  } catch (err) {
    console.error('Spotify search error:', err)
    return NextResponse.json({ error: 'Failed to search Spotify' }, { status: 500 })
  }
}
