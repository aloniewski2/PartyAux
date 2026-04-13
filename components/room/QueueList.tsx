'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QueueItem } from '@/lib/supabase/types'
import QueueItemCard from './QueueItem'
import { getGuestIdentifier } from '@/lib/utils'

interface Props {
  roomId: string
  hostId: string | null
  currentUserId: string | null  // null = guest
  displayName: string
}

export default function QueueList({ roomId, hostId, currentUserId, displayName }: Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const isHost = !!currentUserId && currentUserId === hostId
  const userIdentifier = currentUserId ?? getGuestIdentifier()

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('queue_items')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_played', false)
      .order('pinned', { ascending: false })
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: true })

    if (data) setItems(data)
  }, [roomId])

  const fetchVotes = useCallback(async () => {
    // Find which queue items this user has voted on
    const { data } = await supabase
      .from('votes')
      .select('queue_item_id')
      .eq('user_identifier', userIdentifier)

    if (data) {
      setVotedIds(new Set(data.map((v) => v.queue_item_id)))
    }
  }, [userIdentifier])

  useEffect(() => {
    fetchQueue()
    fetchVotes()

    const queueChannel = supabase
      .channel(`queue:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` },
        () => fetchQueue()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          // If this user just voted, add to local voted set
          const vote = payload.new as { queue_item_id: string; user_identifier: string }
          if (vote.user_identifier === userIdentifier) {
            setVotedIds((prev) => new Set([...prev, vote.queue_item_id]))
          }
          fetchQueue()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(queueChannel) }
  }, [roomId, userIdentifier])

  async function handleVote(itemId: string) {
    try {
      await supabase.rpc('increment_vote', {
        item_id: itemId,
        identifier: userIdentifier,
      })
    } catch (err) {
      console.error('Vote error:', err)
    }
  }

  async function handlePin(itemId: string, pinned: boolean) {
    await supabase
      .from('queue_items')
      .update({ pinned })
      .eq('id', itemId)
  }

  async function handleRemove(itemId: string) {
    await supabase.from('queue_items').delete().eq('id', itemId)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">🎵</div>
        <p className="text-zinc-400 font-medium">Queue is empty</p>
        <p className="text-zinc-600 text-sm mt-1">Search for songs below to add them</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-widest">
          Queue · {items.length} song{items.length !== 1 ? 's' : ''}
        </h2>
      </div>
      {items.map((item, index) => (
        <QueueItemCard
          key={item.id}
          item={item}
          rank={index + 1}
          isHost={isHost}
          hasVoted={votedIds.has(item.id)}
          onVote={handleVote}
          onPin={handlePin}
          onRemove={handleRemove}
        />
      ))}
    </div>
  )
}
