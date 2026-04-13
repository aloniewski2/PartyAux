export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string; width: number; height: number }[]
  }
  duration_ms: number
  uri: string
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[]
  }
}

// Get a client-credentials token (no user auth needed — for search only)
export async function getSpotifyClientToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    next: { revalidate: 3500 }, // cache for ~1 hour (token lasts 3600s)
  })

  if (!res.ok) {
    throw new Error(`Spotify token error: ${res.status}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export async function searchSpotifyTracks(
  query: string,
  accessToken: string,
  limit = 8
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  })

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Spotify search error: ${res.status}`)
  }

  const data: SpotifySearchResult = await res.json()
  return data.tracks.items
}

// Format a SpotifyTrack into the shape we store in the DB
export function formatTrack(track: SpotifyTrack) {
  return {
    spotify_track_id: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album_art_url: track.album.images[0]?.url ?? null,
    uri: track.uri,
    duration_ms: track.duration_ms,
  }
}
