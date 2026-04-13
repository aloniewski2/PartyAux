import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AISuggestion } from '@/app/api/ai-suggestions/route'

interface TrackRef {
  title: string
  artist: string
  vote_count?: number
}

interface RequestBody {
  queue: TrackRef[]          // current unplayed queue
  playHistory: TrackRef[]    // songs already played this session
  topVoted: TrackRef[]       // highest vote_count tracks (may overlap with queue)
}

const FALLBACKS: AISuggestion[] = [
  { title: 'Blinding Lights',   artist: 'The Weeknd',   reason: 'Consistent crowd-pleaser' },
  { title: 'Levitating',        artist: 'Dua Lipa',     reason: 'High energy, everyone knows it' },
  { title: 'HUMBLE.',           artist: 'Kendrick Lamar', reason: 'Hype switch-up' },
  { title: 'Golden Hour',       artist: 'JVKE',         reason: 'Euphoric, singalong-ready' },
  { title: 'Starboy',           artist: 'The Weeknd',   reason: 'Smooth but energetic' },
]

export async function POST(request: Request) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { queue = [], playHistory = [], topVoted = [] } = body

  if (!process.env.GEMINI_API_KEY) {
    const pick = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
    return NextResponse.json({ song: pick })
  }

  const historyText = playHistory.length
    ? playHistory.map((t) => `- "${t.title}" by ${t.artist}`).join('\n')
    : '(none yet — this is the start of the party)'

  const queueText = queue.length
    ? queue.map((t) => `- "${t.title}" by ${t.artist}`).join('\n')
    : '(queue is empty)'

  const votedText = topVoted.length
    ? topVoted
        .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
        .slice(0, 5)
        .map((t) => `- "${t.title}" by ${t.artist} (${t.vote_count ?? 0} votes)`)
        .join('\n')
    : '(no votes recorded yet)'

  const prompt = `You are an AI DJ. A party is in progress. Your job is to pick the single best next song to automatically add to the queue.

Songs already played at this party:
${historyText}

What the crowd has voted for most (their taste signal):
${votedText}

Current upcoming queue (don't duplicate these):
${queueText}

Rules:
1. Match the musical energy and genre of what the crowd has already voted for
2. Do NOT suggest any song already in the play history or current queue
3. Pick a real, well-known song that fits the vibe naturally
4. Prefer songs that are crowd-pleasers and high-energy if the queue is empty
5. Transition smoothly — don't make an abrupt genre jump

Return ONLY a single valid JSON object with these exact keys:
{"title": "Song Title", "artist": "Artist Name", "reason": "One sentence why this fits."}

No markdown, no explanation, just the JSON object.`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const song: AISuggestion = JSON.parse(cleaned)

    if (!song.title || !song.artist) throw new Error('Missing fields')

    return NextResponse.json({ song })
  } catch (err) {
    console.error('AI autopick error:', err)
    const pick = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
    return NextResponse.json({ song: pick, warning: 'AI unavailable — using curated fallback' })
  }
}
