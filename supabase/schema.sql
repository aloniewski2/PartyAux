-- ============================================================
-- QUEUE App — Supabase Schema + RLS Policies
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- rooms
create table if not exists public.rooms (
  id           uuid primary key default uuid_generate_v4(),
  join_code    text unique not null,
  name         text not null,
  host_id      uuid references auth.users(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- room_users (both Spotify-authed users and guests)
create table if not exists public.room_users (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null, -- null for guests
  display_name text not null,
  joined_at    timestamptz not null default now()
);

-- queue_items
create table if not exists public.queue_items (
  id               uuid primary key default uuid_generate_v4(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  spotify_track_id text not null,
  title            text not null,
  artist           text not null,
  album_art_url    text,
  added_by         text not null,        -- display name of who added it
  vote_count       integer not null default 0,
  is_played        boolean not null default false,
  pinned           boolean not null default false,
  created_at       timestamptz not null default now()
);

-- votes
create table if not exists public.votes (
  id              uuid primary key default uuid_generate_v4(),
  queue_item_id   uuid not null references public.queue_items(id) on delete cascade,
  user_identifier text not null,         -- auth user_id OR guest session UUID
  created_at      timestamptz not null default now(),
  unique (queue_item_id, user_identifier)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_rooms_join_code       on public.rooms(join_code);
create index if not exists idx_rooms_is_active       on public.rooms(is_active);
create index if not exists idx_room_users_room_id    on public.room_users(room_id);
create index if not exists idx_queue_items_room_id   on public.queue_items(room_id);
create index if not exists idx_queue_items_vote_count on public.queue_items(vote_count desc);
create index if not exists idx_votes_queue_item_id   on public.votes(queue_item_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.rooms       enable row level security;
alter table public.room_users  enable row level security;
alter table public.queue_items enable row level security;
alter table public.votes       enable row level security;

-- ============================================================
-- RLS POLICIES — rooms
-- ============================================================

-- Anyone can read active rooms (needed to join by code)
create policy "rooms: public read active"
  on public.rooms for select
  using (is_active = true);

-- Only authenticated users can create rooms
create policy "rooms: auth users can insert"
  on public.rooms for insert
  with check (auth.uid() = host_id);

-- Only the host can update their room
create policy "rooms: host can update"
  on public.rooms for update
  using (auth.uid() = host_id);

-- Only the host can delete their room
create policy "rooms: host can delete"
  on public.rooms for delete
  using (auth.uid() = host_id);

-- ============================================================
-- RLS POLICIES — room_users
-- ============================================================

-- Anyone can read who's in a room
create policy "room_users: public read"
  on public.room_users for select
  using (true);

-- Anyone can join a room (insert themselves)
create policy "room_users: anyone can insert"
  on public.room_users for insert
  with check (true);

-- Users can remove themselves (or host can clean up)
create policy "room_users: self delete"
  on public.room_users for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES — queue_items
-- ============================================================

-- Anyone can read queue items
create policy "queue_items: public read"
  on public.queue_items for select
  using (true);

-- Anyone can add songs to a queue (guest or authed)
create policy "queue_items: anyone can insert"
  on public.queue_items for insert
  with check (true);

-- Only host can update (pin, mark played)
create policy "queue_items: host can update"
  on public.queue_items for update
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- Only host can delete songs
create policy "queue_items: host can delete"
  on public.queue_items for delete
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES — votes
-- ============================================================

-- Anyone can read votes
create policy "votes: public read"
  on public.votes for select
  using (true);

-- Anyone can cast a vote (uniqueness constraint prevents double-voting)
create policy "votes: anyone can insert"
  on public.votes for insert
  with check (true);

-- No deletes on votes (immutable)

-- ============================================================
-- REALTIME — enable realtime for live sync
-- ============================================================

-- Enable realtime publications for the tables we need live updates on
alter publication supabase_realtime add table public.queue_items;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.room_users;

-- ============================================================
-- FUNCTION: increment vote count atomically
-- ============================================================

create or replace function public.increment_vote(item_id uuid, identifier text)
returns void
language plpgsql
security definer
as $$
begin
  -- Insert vote record (unique constraint handles double-vote prevention)
  insert into public.votes (queue_item_id, user_identifier)
  values (item_id, identifier);

  -- Increment counter
  update public.queue_items
  set vote_count = vote_count + 1
  where id = item_id;
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function public.increment_vote(uuid, text) to anon, authenticated;
