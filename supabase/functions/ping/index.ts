// 給 GitHub Actions 排程呼叫，讓 Supabase 免費專案維持有流量、
// 不會因連續 7 天無流量而自動暫停。不需要登入，也不回傳任何機敏資料。

import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  // 帶一個很輕量的查詢，讓資料庫也有實際活動
  const { count } = await supabaseAdmin
    .from("branches")
    .select("id", { count: "exact", head: true });

  return jsonResponse({ status: "ok", time: new Date().toISOString(), branch_count: count ?? 0 });
});
