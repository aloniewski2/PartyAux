// Generate a short, human-readable room join code like "AUX-4821"
export function generateJoinCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `AUX-${digits}`
}

// Get or create a stable guest session identifier stored in localStorage
export function getGuestIdentifier(): string {
  if (typeof window === 'undefined') return ''

  const key = 'queue_guest_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

// Format milliseconds to m:ss
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Copy text to clipboard and return success boolean
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Truncate a string to maxLen characters
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}
