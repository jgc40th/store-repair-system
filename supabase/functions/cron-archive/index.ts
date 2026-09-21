// 由 pg_cron 每週呼叫一次（見 supabase/sql/03_cron.sql）。
// 將「已完成」超過 12 個月的報修單標記為封存（is_archived = true）。
//
// 安全性：只信任帶有正確 service_role key 的呼叫者
// （pg_cron 呼叫時會帶 Authorization: Bearer <SERVICE_ROLE_KEY>）。

import { jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .update({ is_archived: true })
    .eq("status", "completed")
    .eq("is_archived", false)
    .lt("accepted_at", twelveMonthsAgo.toISOString())
    .select("id");

  if (error) {
    console.error(error);
    return jsonResponse({ error: "封存作業失敗" }, 500);
  }

  return jsonResponse({ archived_count: data?.length ?? 0 });
});
