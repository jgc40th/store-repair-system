import { supabaseAdmin } from "./supabaseAdmin.ts";

export type AppUser = {
  id: string;
  line_user_id: string;
  display_name: string;
  role: "unassigned" | "branch_staff" | "hq_staff" | "technician" | "admin";
  branch_id: string | null;
  is_active: boolean;
};

/**
 * 從 Authorization: Bearer <session_token> 取出並驗證使用者身份。
 * - session 不存在 / 已過期 / 使用者被停用 → 回傳 null（呼叫端應回應 401）
 */
export async function getSessionUser(req: Request): Promise<AppUser | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "expires_at, app_users:user_id (id, line_user_id, display_name, role, branch_id, is_active)"
    )
    .eq("token", token)
    .single();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const user = data.app_users as unknown as AppUser | null;
  if (!user || !user.is_active) return null;

  return user;
}

/** 檢查角色是否在允許清單中，不符合則回傳 false。 */
export function hasRole(user: AppUser, allowed: AppUser["role"][]): boolean {
  return allowed.includes(user.role);
}
