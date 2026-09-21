// POST /line-login
// body: { code: string, redirect_uri: string }
// 回傳: { session_token, user }
//
// 這支函式「不」需要 Authorization header（登入前使用者當然還沒有 session）。

import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { exchangeLineLogin } from "../_shared/line.ts";

const SESSION_TTL_DAYS = 7;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { code?: string; redirect_uri?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { code, redirect_uri } = body;
  if (!code || !redirect_uri) {
    return jsonResponse({ error: "code 與 redirect_uri 為必填" }, 400);
  }

  try {
    const profile = await exchangeLineLogin(code, redirect_uri);

    // upsert app_users：第一次登入建立新帳號（角色預設 unassigned，
    // 需系統管理員到帳號管理頁指派角色後才能操作報修）
    const { data: user, error: upsertError } = await supabaseAdmin
      .from("app_users")
      .upsert(
        {
          line_user_id: profile.sub,
          display_name: profile.name,
          picture_url: profile.picture ?? null,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "line_user_id" }
      )
      .select("id, line_user_id, display_name, role, branch_id, is_active")
      .single();

    if (upsertError || !user) {
      console.error(upsertError);
      return jsonResponse({ error: "建立使用者資料失敗" }, 500);
    }

    if (!user.is_active) {
      return jsonResponse({ error: "此帳號已被停用，請聯絡系統管理員" }, 403);
    }

    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({ user_id: user.id, expires_at: expiresAt })
      .select("token")
      .single();

    if (sessionError || !session) {
      console.error(sessionError);
      return jsonResponse({ error: "建立登入 session 失敗" }, 500);
    }

    return jsonResponse({
      session_token: session.token,
      expires_at: expiresAt,
      user,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "LINE 登入驗證失敗，請重新登入" }, 401);
  }
});
