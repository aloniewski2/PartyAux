import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface AISuggestion {
  title: string
  artist: string
  reason: string
}

interface RequestBody {
  queue: { title: string; artist: string }[]
  vibes: string[]
}

const FALLBACK_SUGGESTIONS: AISuggestion[] = [
  { title: 'Blinding Lights', artist: 'The Weeknd', reason: 'High-energy crowd-pleaser' },
  { title: 'As It Was', artist: 'Harry Styles', reason: 'Feel-good modern hit' },
  { title: 'Levitating', artist: 'Dua Lipa', reason: 'Perfect dance floor energy' },
  { title: 'Golden Hour', artist: 'JVKE', reason: 'Euphoric vibes everyone loves' },
  { title: 'Flowers', artist: 'Miley Cyrus', reason: 'Instant singalong moment' },
]

export async function POST(request: Request) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { queue = [], vibes = [] } = body

  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set — returning fallback suggestions')
    return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS })
  }

  const queueText =
    queue.length > 0
      ? queue.map((t) => `- "${t.title}" by ${t.artist}`).join('\n')
      : '(queue is currently empty)'

  const vibeText =
    vibes.length > 0 ? vibes.join(', ') : 'general party mix'

  const prompt = `You are a DJ assistant helping curate a party playlist.

Current queue:
${queueText}

Requested vibes: ${vibeText}

Suggest exactly 5 songs that:
1. Match the requested vibes
2. Complement (not repeat) the existing queue
3. Are real, popular songs people will recognise

Return ONLY a valid JSON array with exactly 5 objects. Each object must have these exact keys:
- "title": song title (string)
- "artist": artist name (string)
- "reason": one sentence explaining why this song fits (string)

Example format:
[
  {"title": "Song Name", "artist": "Artist Name", "reason": "Why it fits."},
  ...
]

Return only the JSON array, no markdown, no explanation outside the array.`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Strip markdown code fences if Gemini wraps its response
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const suggestions: AISuggestion[] = JSON.parse(cleaned)

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Gemini returned unexpected format')
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) })
  } catch (err) {
    console.error('Gemini AI error:', err)
    // Return fallback so the UI never fully breaks
    return NextResponse.json({
      suggestions: FALLBACK_SUGGESTIONS,
      warning: 'AI suggestions unavailable — showing curated fallbacks',
    })
  }
}
