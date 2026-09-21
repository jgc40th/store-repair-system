-- ============================================================
-- 連鎖汽車旅館 設備線上報修系統 — 資料表結構
-- 於 Supabase SQL Editor 依序執行 01_schema.sql → 02_policies.sql → 03_cron.sql
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_net;     -- 供 cron 呼叫 Edge Function 用

-- ------------------------------------------------------------
-- 列舉型別
-- ------------------------------------------------------------
do $$ begin
  create type user_role as enum ('unassigned','branch_staff','hq_staff','technician','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('pending','assigned','pending_review','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('normal','urgent');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 分館
-- ------------------------------------------------------------
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 使用者（對應 LINE 帳號，非 Supabase Auth 內建 auth.users）
-- ------------------------------------------------------------
create table if not exists app_users (
  id             uuid primary key default gen_random_uuid(),
  line_user_id   text not null unique,
  display_name   text not null,
  picture_url    text,
  role           user_role not null default 'unassigned',
  branch_id      uuid references branches(id),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

create index if not exists idx_app_users_role on app_users(role);
create index if not exists idx_app_users_branch on app_users(branch_id);

-- ------------------------------------------------------------
-- 登入 Session（自訂 token，取代 Supabase Auth 的 JWT session）
-- ------------------------------------------------------------
create table if not exists sessions (
  token       uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expires on sessions(expires_at);

-- ------------------------------------------------------------
-- 報修單
-- ------------------------------------------------------------
create table if not exists tickets (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  branch_id                uuid not null references branches(id),
  location_detail          text,
  category                 text not null,
  priority                 ticket_priority not null default 'normal',
  description              text not null,
  status                   ticket_status not null default 'pending',
  submitted_by             uuid not null references app_users(id),
  assigned_technician_id   uuid references app_users(id),
  completion_note          text,
  rejection_note           text,
  is_archived              boolean not null default false,
  created_at               timestamptz not null default now(),
  dispatched_at            timestamptz,
  completed_at             timestamptz,
  accepted_at              timestamptz
);

create index if not exists idx_tickets_branch on tickets(branch_id);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_tickets_technician on tickets(assigned_technician_id);
create index if not exists idx_tickets_archived on tickets(is_archived);
create index if not exists idx_tickets_created on tickets(created_at desc);

-- ------------------------------------------------------------
-- 狀態歷程紀錄
-- ------------------------------------------------------------
create table if not exists ticket_logs (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references tickets(id) on delete cascade,
  from_status   ticket_status,
  to_status     ticket_status not null,
  changed_by    uuid references app_users(id),
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ticket_logs_ticket on ticket_logs(ticket_id);
