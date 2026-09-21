-- ============================================================
-- Row Level Security 規則
--
-- 安全模型：
--   1. 前端「不」直接使用 anon key 讀寫 tickets / app_users / sessions 等資料，
--      一律透過 Edge Functions（以 service_role key 執行，會略過 RLS）存取。
--   2. 因此這裡對所有資料表啟用 RLS，且「不」開放 anon / authenticated 角色
--      任何政策 → 等同預設全部拒絕，即使 anon key 外流也讀不到任何一筆資料。
--   3. 唯一例外：分館清單（branches）允許公開唯讀啟用中的分館，
--      方便前端表單下拉選單可以不經過 Edge Function 直接查詢（可依需求移除）。
-- ============================================================

alter table branches     enable row level security;
alter table app_users    enable row level security;
alter table sessions     enable row level security;
alter table tickets      enable row level security;
alter table ticket_logs  enable row level security;

-- 分館清單：僅開放讀取「已啟用」分館的公開欄位，不開放新增/修改/刪除
drop policy if exists "public read active branches" on branches;
create policy "public read active branches"
  on branches for select
  to anon, authenticated
  using (is_active = true);

-- 其餘資料表：不建立任何 anon / authenticated 政策 → 一律拒絕直接存取，
-- 所有讀寫都必須透過 Edge Function（service_role）進行。
