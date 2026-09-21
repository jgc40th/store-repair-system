// 主要業務 API（需先登入，帶 Authorization: Bearer <session_token>）
//
// 呼叫方式：
//   GET  /api?action=list_tickets&status=pending&page=1
//   GET  /api?action=get_ticket&id=<uuid>
//   GET  /api?action=list_branches
//   GET  /api?action=list_accounts
//   GET  /api?action=stats
//   POST /api   body: { action: "submit_ticket", ...payload }
//
// 所有動作都會先驗證 session、再依角色檢查是否有權限執行。

import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getSessionUser, hasRole, AppUser } from "../_shared/auth.ts";
import { pushLineMessage, pushLineMessageToMany } from "../_shared/line.ts";

const PAGE_SIZE = 20;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const user = await getSessionUser(req);
  if (!user) return jsonResponse({ error: "尚未登入或登入已過期" }, 401);
  if (user.role === "unassigned") {
    return jsonResponse(
      { error: "帳號尚未指派角色，請聯絡系統管理員" },
      403
    );
  }

  const url = new URL(req.url);
  let action: string | null;
  let payload: Record<string, unknown> = {};

  if (req.method === "GET") {
    action = url.searchParams.get("action");
    payload = Object.fromEntries(url.searchParams.entries());
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      action = body.action ?? null;
      payload = body;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
  } else {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    switch (action) {
      case "list_tickets":
        return await listTickets(user, payload);
      case "get_ticket":
        return await getTicket(user, payload);
      case "submit_ticket":
        return await submitTicket(user, payload);
      case "dispatch_ticket":
        return await dispatchTicket(user, payload);
      case "complete_ticket":
        return await completeTicket(user, payload);
      case "accept_ticket":
        return await acceptTicket(user, payload);
      case "cancel_ticket":
        return await cancelTicket(user, payload);
      case "delete_ticket":
        return await deleteTicket(user, payload);
      case "list_branches":
        return await listBranches(user);
      case "create_branch":
        return await createBranch(user, payload);
      case "update_branch":
        return await updateBranch(user, payload);
      case "list_accounts":
        return await listAccounts(user);
      case "update_account":
        return await updateAccount(user, payload);
      case "list_technicians":
        return await listTechnicians(user);
      case "stats":
        return await stats(user);
      default:
        return jsonResponse({ error: `未知的 action: ${action}` }, 400);
    }
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "系統發生錯誤，請稍後再試" }, 500);
  }
});

// ------------------------------------------------------------
// 共用小工具
// ------------------------------------------------------------

async function insertLog(
  ticketId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string,
  note?: string | null
) {
  await supabaseAdmin.from("ticket_logs").insert({
    ticket_id: ticketId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    note: note ?? null,
  });
}

async function getTicketOr404(id: string) {
  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data;
}

const TICKET_SELECT = `
  id, title, branch_id, location_detail, category, priority, status,
  description, completion_note, rejection_note, is_archived,
  created_at, dispatched_at, completed_at, accepted_at,
  submitted_by, assigned_technician_id,
  branch:branch_id ( id, name ),
  submitter:submitted_by ( id, display_name ),
  technician:assigned_technician_id ( id, display_name )
`;

// ------------------------------------------------------------
// 報修單
// ------------------------------------------------------------

async function listTickets(user: AppUser, q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q.page ?? "1"), 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin
    .from("tickets")
    .select(TICKET_SELECT, { count: "exact" })
    .eq("is_archived", q.archived === "true")
    .order("created_at", { ascending: false })
    .range(from, to);

  // 依角色限制可見範圍
  if (user.role === "branch_staff") {
    query = query.eq("branch_id", user.branch_id);
  } else if (user.role === "technician") {
    query = query.eq("assigned_technician_id", user.id);
  }
  // hq_staff / admin 可看全部

  if (q.status) query = query.eq("status", String(q.status));
  if (q.branch_id) query = query.eq("branch_id", String(q.branch_id));
  if (q.category) query = query.eq("category", String(q.category));
  if (q.search) query = query.ilike("title", `%${q.search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return jsonResponse({ tickets: data, total: count, page, page_size: PAGE_SIZE });
}

async function getTicket(user: AppUser, q: Record<string, unknown>) {
  const id = String(q.id ?? "");
  if (!id) return jsonResponse({ error: "缺少 id" }, 400);

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("id", id)
    .single();

  if (error || !ticket) return jsonResponse({ error: "找不到報修單" }, 404);

  if (!canViewTicket(user, ticket)) {
    return jsonResponse({ error: "沒有權限查看此報修單" }, 403);
  }

  const { data: logs } = await supabaseAdmin
    .from("ticket_logs")
    .select("id, from_status, to_status, note, created_at, changed_by:changed_by ( display_name )")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return jsonResponse({ ticket, logs: logs ?? [] });
}

function canViewTicket(user: AppUser, ticket: { branch_id: string; assigned_technician_id: string | null }) {
  if (user.role === "hq_staff" || user.role === "admin") return true;
  if (user.role === "branch_staff") return ticket.branch_id === user.branch_id;
  if (user.role === "technician") return ticket.assigned_technician_id === user.id;
  return false;
}

async function submitTicket(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["branch_staff", "hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限提交報修單" }, 403);
  }

  const title = String(p.title ?? "").trim();
  const category = String(p.category ?? "").trim();
  const description = String(p.description ?? "").trim();
  const priority = p.priority === "urgent" ? "urgent" : "normal";
  const locationDetail = p.location_detail ? String(p.location_detail) : null;

  // 分館人員只能替自己分館提交；總務窗口/系統管理員可指定分館
  const branchId =
    user.role === "branch_staff" ? user.branch_id : String(p.branch_id ?? "");

  if (!title || !category || !description || !branchId) {
    return jsonResponse({ error: "title、category、description、branch_id 為必填" }, 400);
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .insert({
      title,
      branch_id: branchId,
      location_detail: locationDetail,
      category,
      priority,
      description,
      status: "pending",
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error || !ticket) throw error;
  await insertLog(ticket.id, null, "pending", user.id);

  // 通知所有總務窗口人員與系統管理員
  const { data: hqUsers } = await supabaseAdmin
    .from("app_users")
    .select("line_user_id")
    .in("role", ["hq_staff", "admin"])
    .eq("is_active", true);

  await pushLineMessageToMany(
    (hqUsers ?? []).map((u) => u.line_user_id),
    `📋 新報修單待受理\n標題：${title}\n優先級：${priority === "urgent" ? "🔴 緊急" : "普通"}\n請登入系統查看並派工。`
  );

  return jsonResponse({ id: ticket.id });
}

async function dispatchTicket(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限受理派工" }, 403);
  }
  const ticketId = String(p.ticket_id ?? "");
  const technicianId = String(p.technician_id ?? "");
  if (!ticketId || !technicianId) {
    return jsonResponse({ error: "ticket_id、technician_id 為必填" }, 400);
  }

  const ticket = await getTicketOr404(ticketId);
  if (!ticket) return jsonResponse({ error: "找不到報修單" }, 404);
  if (!["pending", "assigned"].includes(ticket.status)) {
    return jsonResponse({ error: "此狀態的報修單無法派工" }, 400);
  }

  const { data: technician } = await supabaseAdmin
    .from("app_users")
    .select("id, line_user_id, role, is_active")
    .eq("id", technicianId)
    .single();

  if (!technician || technician.role !== "technician" || !technician.is_active) {
    return jsonResponse({ error: "指定的工務人員無效" }, 400);
  }

  const isRedispatch = ticket.status === "assigned";
  const previousTechnicianId = ticket.assigned_technician_id;

  const { error } = await supabaseAdmin
    .from("tickets")
    .update({
      assigned_technician_id: technicianId,
      status: "assigned",
      dispatched_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (error) throw error;

  await insertLog(
    ticketId,
    ticket.status,
    "assigned",
    user.id,
    isRedispatch ? "重新派工" : "受理並派工"
  );

  await pushLineMessage(
    technician.line_user_id,
    `🔧 您有新的派工單\n標題：${ticket.title}\n請登入系統查看詳情並前往處理。`
  );

  if (isRedispatch && previousTechnicianId && previousTechnicianId !== technicianId) {
    const { data: prevTech } = await supabaseAdmin
      .from("app_users")
      .select("line_user_id")
      .eq("id", previousTechnicianId)
      .single();
    if (prevTech) {
      await pushLineMessage(
        prevTech.line_user_id,
        `ℹ️ 報修單「${ticket.title}」已改派給其他工務人員處理。`
      );
    }
  }

  return jsonResponse({ ok: true });
}

async function completeTicket(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["technician", "admin"])) {
    return jsonResponse({ error: "沒有權限標記完成" }, 403);
  }
  const ticketId = String(p.ticket_id ?? "");
  const completionNote = p.completion_note ? String(p.completion_note) : null;
  if (!ticketId) return jsonResponse({ error: "缺少 ticket_id" }, 400);

  const ticket = await getTicketOr404(ticketId);
  if (!ticket) return jsonResponse({ error: "找不到報修單" }, 404);
  if (ticket.status !== "assigned") {
    return jsonResponse({ error: "此狀態的報修單無法標記完成" }, 400);
  }
  if (user.role === "technician" && ticket.assigned_technician_id !== user.id) {
    return jsonResponse({ error: "您不是此報修單的負責工務人員" }, 403);
  }

  const { error } = await supabaseAdmin
    .from("tickets")
    .update({
      status: "pending_review",
      completed_at: new Date().toISOString(),
      completion_note: completionNote,
    })
    .eq("id", ticketId);
  if (error) throw error;

  await insertLog(ticketId, "assigned", "pending_review", user.id, completionNote);

  const { data: branchUsers } = await supabaseAdmin
    .from("app_users")
    .select("line_user_id")
    .eq("branch_id", ticket.branch_id)
    .eq("role", "branch_staff")
    .eq("is_active", true);

  await pushLineMessageToMany(
    (branchUsers ?? []).map((u) => u.line_user_id),
    `✅ 報修單已完成維修，待驗收\n標題：${ticket.title}\n請登入系統確認並完成驗收。`
  );

  return jsonResponse({ ok: true });
}

async function acceptTicket(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["branch_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限進行驗收" }, 403);
  }
  const ticketId = String(p.ticket_id ?? "");
  const decision = p.decision === "reject" ? "reject" : "approve";
  const rejectionNote = p.rejection_note ? String(p.rejection_note) : null;
  if (!ticketId) return jsonResponse({ error: "缺少 ticket_id" }, 400);

  const ticket = await getTicketOr404(ticketId);
  if (!ticket) return jsonResponse({ error: "找不到報修單" }, 404);
  if (ticket.status !== "pending_review") {
    return jsonResponse({ error: "此狀態的報修單無法驗收" }, 400);
  }
  if (user.role === "branch_staff" && ticket.branch_id !== user.branch_id) {
    return jsonResponse({ error: "您不是此報修單所屬分館的人員" }, 403);
  }

  const newStatus = decision === "approve" ? "completed" : "assigned";
  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (decision === "approve") {
    updatePayload.accepted_at = new Date().toISOString();
  } else {
    updatePayload.rejection_note = rejectionNote;
  }

  const { error } = await supabaseAdmin
    .from("tickets")
    .update(updatePayload)
    .eq("id", ticketId);
  if (error) throw error;

  await insertLog(
    ticketId,
    "pending_review",
    newStatus,
    user.id,
    decision === "approve" ? "驗收通過" : `驗收不通過：${rejectionNote ?? ""}`
  );

  const notifyIds: string[] = [];
  if (ticket.assigned_technician_id) {
    const { data: tech } = await supabaseAdmin
      .from("app_users")
      .select("line_user_id")
      .eq("id", ticket.assigned_technician_id)
      .single();
    if (tech) notifyIds.push(tech.line_user_id);
  }
  const { data: hqUsers } = await supabaseAdmin
    .from("app_users")
    .select("line_user_id")
    .in("role", ["hq_staff", "admin"])
    .eq("is_active", true);
  notifyIds.push(...(hqUsers ?? []).map((u) => u.line_user_id));

  await pushLineMessageToMany(
    notifyIds,
    decision === "approve"
      ? `🎉 報修單已驗收通過並結案\n標題：${ticket.title}`
      : `↩ 報修單驗收不通過，已退回維修\n標題：${ticket.title}\n原因：${rejectionNote ?? "（未填寫）"}`
  );

  return jsonResponse({ ok: true });
}

async function cancelTicket(user: AppUser, p: Record<string, unknown>) {
  const ticketId = String(p.ticket_id ?? "");
  if (!ticketId) return jsonResponse({ error: "缺少 ticket_id" }, 400);

  const ticket = await getTicketOr404(ticketId);
  if (!ticket) return jsonResponse({ error: "找不到報修單" }, 404);
  if (ticket.status !== "pending") {
    return jsonResponse({ error: "只有「待處理」狀態才能取消" }, 400);
  }
  const isOwner = ticket.submitted_by === user.id;
  if (!isOwner && user.role !== "admin") {
    return jsonResponse({ error: "只有提交者本人或系統管理員能取消" }, 403);
  }

  const { error } = await supabaseAdmin
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("id", ticketId);
  if (error) throw error;

  await insertLog(ticketId, "pending", "cancelled", user.id);
  return jsonResponse({ ok: true });
}

async function deleteTicket(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限刪除報修單" }, 403);
  }
  const ticketId = String(p.ticket_id ?? "");
  if (!ticketId) return jsonResponse({ error: "缺少 ticket_id" }, 400);

  const { error } = await supabaseAdmin.from("tickets").delete().eq("id", ticketId);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

// ------------------------------------------------------------
// 分館管理（系統管理員）
// ------------------------------------------------------------

async function listBranches(user: AppUser) {
  if (!hasRole(user, ["hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限" }, 403);
  }
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return jsonResponse({ branches: data });
}

async function createBranch(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["admin"])) return jsonResponse({ error: "沒有權限" }, 403);
  const name = String(p.name ?? "").trim();
  if (!name) return jsonResponse({ error: "缺少 name" }, 400);
  const { data, error } = await supabaseAdmin
    .from("branches")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return jsonResponse({ id: data.id });
}

async function updateBranch(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["admin"])) return jsonResponse({ error: "沒有權限" }, 403);
  const id = String(p.id ?? "");
  if (!id) return jsonResponse({ error: "缺少 id" }, 400);
  const update: Record<string, unknown> = {};
  if (typeof p.name === "string") update.name = p.name;
  if (typeof p.is_active === "boolean") update.is_active = p.is_active;
  const { error } = await supabaseAdmin.from("branches").update(update).eq("id", id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

// ------------------------------------------------------------
// 帳號管理（系統管理員）
// ------------------------------------------------------------

async function listAccounts(user: AppUser) {
  if (!hasRole(user, ["admin"])) return jsonResponse({ error: "沒有權限" }, 403);
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, display_name, role, branch_id, is_active, last_login_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse({ accounts: data });
}

async function updateAccount(user: AppUser, p: Record<string, unknown>) {
  if (!hasRole(user, ["admin"])) return jsonResponse({ error: "沒有權限" }, 403);
  const id = String(p.id ?? "");
  if (!id) return jsonResponse({ error: "缺少 id" }, 400);

  const validRoles = ["unassigned", "branch_staff", "hq_staff", "technician", "admin"];
  const update: Record<string, unknown> = {};
  if (typeof p.role === "string" && validRoles.includes(p.role)) update.role = p.role;
  if (typeof p.branch_id === "string" || p.branch_id === null) update.branch_id = p.branch_id;
  if (typeof p.is_active === "boolean") update.is_active = p.is_active;

  const { error } = await supabaseAdmin.from("app_users").update(update).eq("id", id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

async function listTechnicians(user: AppUser) {
  if (!hasRole(user, ["hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限" }, 403);
  }
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, display_name")
    .eq("role", "technician")
    .eq("is_active", true);
  if (error) throw error;
  return jsonResponse({ technicians: data });
}

// ------------------------------------------------------------
// 統計
// ------------------------------------------------------------

async function stats(user: AppUser) {
  if (!hasRole(user, ["hq_staff", "admin"])) {
    return jsonResponse({ error: "沒有權限" }, 403);
  }

  const statuses = ["pending", "assigned", "pending_review", "completed", "cancelled"];
  const counts: Record<string, number> = {};
  for (const s of statuses) {
    const { count } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", s);
    counts[s] = count ?? 0;
  }

  const { count: archivedCount } = await supabaseAdmin
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", true);

  return jsonResponse({ status_counts: counts, archived_count: archivedCount ?? 0 });
}
