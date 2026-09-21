import { createClient } from "npm:@supabase/supabase-js@2";

// 這個 client 一律使用 SERVICE_ROLE_KEY，會略過 RLS。
// 絕對不能把這支 key 交給前端或寫進前端程式碼，只能存在於 Edge Function 環境變數中。
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
