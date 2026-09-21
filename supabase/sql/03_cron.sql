-- ============================================================
-- 排程工作：透過 pg_cron + pg_net 呼叫 Edge Function
--
-- 使用前請先：
--   1. 到 Supabase 後台 Database → Extensions 啟用 "pg_cron"
--      （或執行下面第一行 create extension）
--   2. 將 <PROJECT_REF> 換成你的 Supabase 專案代碼
--   3. 將 <SERVICE_ROLE_KEY> 換成你的 service_role key
--      （建議改存在 Vault，這裡先以純文字示範，正式環境請改用
--       supabase_vault.create_secret 並以 vault.decrypted_secrets 讀取）
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- 每週日 03:00 UTC（台灣時間 11:00）執行一次封存作業：
-- 將「已完成」超過 12 個月的報修單標記為 is_archived = true
select cron.schedule(
  'archive-old-tickets-weekly',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/cron-archive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 如需查看已排程的工作：
-- select * from cron.job;

-- 如需移除排程：
-- select cron.unschedule('archive-old-tickets-weekly');

-- ------------------------------------------------------------
-- 注意：Supabase 免費專案若連續 7 天沒有任何流量會自動暫停，
-- 暫停期間 pg_cron 也不會執行。請務必同時設定
-- .github/workflows/keepalive.yml，定期呼叫 ping Edge Function
-- 讓專案維持在啟用狀態，排程才會確實觸發。
-- ------------------------------------------------------------
