'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { QueueItem as QueueItemType } from '@/lib/supabase/types'

interface Props {
  item: QueueItemType
  isHost: boolean
  hasVoted: boolean
  onVote: (itemId: string) => Promise<void>
  onPin: (itemId: string, pinned: boolean) => Promise<void>
  onRemove: (itemId: string) => Promise<void>
  rank: number
}

export default function QueueItemCard({
  item,
  isHost,
  hasVoted,
  onVote,
  onPin,
  onRemove,
  rank,
}: Props) {
  const [voting, setVoting] = useState(false)

  async function handleVote() {
    if (hasVoted || voting) return
    setVoting(true)
    await onVote(item.id)
    setVoting(false)
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300
        ${item.pinned
          ? 'bg-purple-900/40 border border-purple-500/50'
          : 'bg-zinc-800/60 border border-transparent hover:border-zinc-700'
        }`}
    >
      {/* Rank number */}
      <span className="text-zinc-600 text-xs font-mono w-4 text-center shrink-0">
        {rank}
      </span>

      {/* Album art */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-700">
        {item.album_art_url ? (
          <Image
            src={item.album_art_url}
            alt={`${item.title} album art`}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{item.title}</p>
        <p className="text-zinc-400 text-xs truncate">{item.artist}</p>
        <p className="text-zinc-600 text-xs mt-0.5">added by {item.added_by}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Pin indicator */}
        {item.pinned && (
          <span className="text-purple-400 text-xs font-medium">NEXT</span>
        )}

        {/* Host controls */}
        {isHost && (
          <>
            <button
              onClick={() => onPin(item.id, !item.pinned)}
              title={item.pinned ? 'Unpin' : 'Pin as next'}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-purple-400 hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 4v6l2 3v2h-6v5l-1 1-1-1v-5H5v-2l2-3V4c0-.55.45-1 1-1h8c.55 0 1 .45 1 1z" />
              </svg>
            </button>
            <button
              onClick={() => onRemove(item.id)}
              title="Remove"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        {/* Vote button */}
        <button
          onClick={handleVote}
          disabled={hasVoted || voting}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all
            ${hasVoted
              ? 'text-purple-400 bg-purple-900/30 cursor-default'
              : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-700 active:scale-95'
            } ${voting ? 'opacity-50' : ''}`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill={hasVoted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-bold">{item.vote_count}</span>
        </button>
      </div>
    </div>
  )
}
