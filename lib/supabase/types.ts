export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string
          join_code: string
          name: string
          host_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          join_code: string
          name: string
          host_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          join_code?: string
          name?: string
          host_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      room_users: {
        Row: {
          id: string
          room_id: string
          user_id: string | null
          display_name: string
          joined_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id?: string | null
          display_name: string
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string | null
          display_name?: string
          joined_at?: string
        }
        Relationships: []
      }
      queue_items: {
        Row: {
          id: string
          room_id: string
          spotify_track_id: string
          title: string
          artist: string
          album_art_url: string | null
          added_by: string
          vote_count: number
          is_played: boolean
          pinned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          spotify_track_id: string
          title: string
          artist: string
          album_art_url?: string | null
          added_by: string
          vote_count?: number
          is_played?: boolean
          pinned?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          spotify_track_id?: string
          title?: string
          artist?: string
          album_art_url?: string | null
          added_by?: string
          vote_count?: number
          is_played?: boolean
          pinned?: boolean
          created_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          id: string
          queue_item_id: string
          user_identifier: string
          created_at: string
        }
        Insert: {
          id?: string
          queue_item_id: string
          user_identifier: string
          created_at?: string
        }
        Update: {
          id?: string
          queue_item_id?: string
          user_identifier?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_vote: {
        Args: { item_id: string; identifier: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row types
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomUser = Database['public']['Tables']['room_users']['Row']
export type QueueItem = Database['public']['Tables']['queue_items']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']
