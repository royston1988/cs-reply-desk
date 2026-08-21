-- ============================================================
--  CS Reply Desk — one-time database setup
--  Run this ONCE in Supabase:
--  https://supabase.com/dashboard/project/qiyfuxiccphxlnrhsmvf/sql/new
--  Paste everything, press RUN.
--
--  It creates FOUR new tables. It does not touch cs_fb_inbox,
--  cs_reply_log, or anything the AC OS dashboard uses.
-- ============================================================

-- 1. Cases — who owns a return/exchange/complaint and is it done
create table if not exists public.cs_cases (
  conv_id    text primary key,
  status     text not null default 'open',        -- open | waiting_customer | done
  owner      text default '',
  note       text default '',
  updated_at timestamptz not null default now()
);
create index if not exists cs_cases_updated_idx on public.cs_cases (updated_at desc);

-- 2. Staff — one row per CS person, each with their own PIN
create table if not exists public.cs_staff (
  id        text primary key,                     -- short code, e.g. 'chin-pui'
  name      text not null,
  pin_hash  text not null,                        -- never the PIN itself
  role      text not null default 'cs',           -- 'cs' or 'admin'
  active    boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Point rules — what each task is worth. Editable in the Admin screen.
create table if not exists public.cs_point_rules (
  action     text primary key,
  label      text not null,
  points     integer not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 4. Point ledger — every point ever earned, and why
create table if not exists public.cs_points (
  id         bigint generated always as identity primary key,
  staff_id   text not null,
  action     text not null,
  points     integer not null,
  ref        text default '',                     -- which conversation / case
  note       text default '',
  created_at timestamptz not null default now()
);
create index if not exists cs_points_staff_idx on public.cs_points (staff_id, created_at desc);
-- One award per person per action per conversation. Stops double-claiming.
create unique index if not exists cs_points_once_idx on public.cs_points (staff_id, action, ref);

-- Locked down, same as your other tables. Only the server (secret key) reads them.
alter table public.cs_cases       enable row level security;
alter table public.cs_staff       enable row level security;
alter table public.cs_point_rules enable row level security;
alter table public.cs_points      enable row level security;

-- ---------- starting staff ----------
-- PINs below are temporary. Change them in the Admin screen after logging in.
--   Chin Pui 1111 · Evelyn 2222 · Yan 3333 · Roy 9999 (admin)
insert into public.cs_staff (id, name, pin_hash, role) values
  ('chin-pui', 'Chin Pui', '35353ed92a1fc2cb321db07337cbbfd922ff7810b7d542a42d0253a6205534e2', 'cs'),
  ('evelyn',   'Evelyn',   '3ef16fe2d2f3847df76785925406105d49c60d370bc12fe5862263cfe5214e04', 'cs'),
  ('yan',      'Yan',      'e1d21b5aa5dd634916993dfc88ab931937ecf7c4ec84b0e1ba05d60263ee60ef', 'cs'),
  ('roy',      'Roy',      '26bae666311fafd3ac434fbd921bbc5fc3bb87fd3597bf3e80b1c762a0d37020', 'admin')
on conflict (id) do nothing;

-- ---------- starting point values ----------
-- Deliberately weighted so the things that hurt the business pay the most:
-- rescuing someone who has been waiting hours is worth more than a quick easy reply.
insert into public.cs_point_rules (action, label, points) values
  ('reply_sent',       'Replied to a customer',                      1),
  ('fast_reply',       'Replied within 15 minutes',                  2),
  ('case_closed',      'Closed a case (customer was actually replied to)', 3),
  ('complaint_closed', 'Closed a complaint',                         5),
  ('rescue',           'Answered someone who waited over 6 hours',   5)
on conflict (action) do nothing;
