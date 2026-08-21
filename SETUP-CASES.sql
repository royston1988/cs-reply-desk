-- Run this ONCE in Supabase to make the Cases board remember things.
--
-- Where: https://supabase.com/dashboard/project/qiyfuxiccphxlnrhsmvf/sql/new
-- Paste everything below, press RUN.
--
-- It creates ONE new table. It does not touch cs_fb_inbox, cs_reply_log,
-- or anything the AC OS dashboard uses. Nothing existing changes.

create table if not exists public.cs_cases (
  conv_id    text primary key,          -- the Facebook conversation this case is about
  status     text not null default 'open',   -- open | waiting_customer | done
  owner      text default '',           -- which CS person owns it
  note       text default '',           -- free note
  updated_at timestamptz not null default now()
);

-- Locked down by default, same as the rest of your tables: nothing can read or
-- write it except the server, which uses the secret key and bypasses these rules.
alter table public.cs_cases enable row level security;

-- Handy for sorting the board by most recently touched.
create index if not exists cs_cases_updated_idx on public.cs_cases (updated_at desc);
