import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { Ticket, TicketLog, STATUS_LABEL } from "../types";
import StatusBadge from "../components/StatusBadge";

interface Technician {
  id: string;
  display_name: string;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [logs, setLogs] = useState<TicketLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 表單狀態
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiGet<{ ticket: Ticket; logs: TicketLog[] }>("get_ticket", { id });
      setTicket(data.ticket);
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if ((user?.role === "hq_staff" || user?.role === "admin") && ticket) {
      apiGet<{ technicians: Technician[] }>("list_technicians").then((d) =>
        setTechnicians(d.technicians)
      );
    }
  }, [user, ticket?.id]);

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-center text-gray-400 py-10">載入中…</p>;
  if (!ticket) return <p className="text-center text-red-600 py-10">{error ?? "找不到報修單"}</p>;
  if (!user) return null;

  const isOwner = ticket.submitted_by === user.id;
  const isAssignedTechnician = ticket.assigned_technician_id === user.id;
  const isSameBranch = ticket.branch_id === user.branch_id;

  const canDispatch = (user.role === "hq_staff" || user.role === "admin") &&
    ["pending", "assigned"].includes(ticket.status);
  const canComplete = (user.role === "technician" && isAssignedTechnician && ticket.status === "assigned") ||
    (user.role === "admin" && ticket.status === "assigned");
  const canAccept = ((user.role === "branch_staff" && isSameBranch) || user.role === "admin") &&
    ticket.status === "pending_review";
  const canCancel = (isOwner || user.role === "admin") && ticket.status === "pending";
  const canDelete = user.role === "hq_staff" || user.role === "admin";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-700">
        ← 返回清單
      </button>

      <div className="bg-white border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold">{ticket.title}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="text-sm text-gray-500 mt-2 space-y-1">
          <p>🏨 分館：{ticket.branch?.name}{ticket.location_detail ? `（${ticket.location_detail}）` : ""}</p>
          <p>📂 類別：{ticket.category}　{ticket.priority === "urgent" && <span className="text-red-600 font-semibold">🔴 緊急</span>}</p>
          <p>🙋 提交人：{ticket.submitter?.display_name}</p>
          {ticket.technician && <p>🔧 工務人員：{ticket.technician.display_name}</p>}
        </div>
        <p className="mt-3 text-sm whitespace-pre-wrap">{ticket.description}</p>

        {ticket.completion_note && (
          <div className="mt-3 bg-green-50 text-green-800 text-sm rounded-lg p-3">
            <b>完成說明：</b>{ticket.completion_note}
          </div>
        )}
        {ticket.rejection_note && (
          <div className="mt-3 bg-red-50 text-red-700 text-sm rounded-lg p-3">
            <b>驗收退回原因：</b>{ticket.rejection_note}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {canDispatch && (
        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">總務窗口操作</h2>
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">請選擇工務人員</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.display_name}</option>
            ))}
          </select>
          <button
            disabled={busy || !selectedTechnician}
            onClick={() =>
              runAction(() => apiPost("dispatch_ticket", { ticket_id: ticket.id, technician_id: selectedTechnician }))
            }
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-xl disabled:opacity-50"
          >
            {ticket.status === "assigned" ? "重新派工" : "✔ 受理並派工"}
          </button>
        </div>
      )}

      {canComplete && (
        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">工務人員操作</h2>
          <textarea
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            placeholder="完成說明（建議填寫維修內容、更換零件等）"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            onClick={() =>
              runAction(() => apiPost("complete_ticket", { ticket_id: ticket.id, completion_note: completionNote }))
            }
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-xl disabled:opacity-50"
          >
            🔧 標記維修完成
          </button>
        </div>
      )}

      {canAccept && (
        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">分館驗收</h2>
          {!showRejectForm ? (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => runAction(() => apiPost("accept_ticket", { ticket_id: ticket.id, decision: "approve" }))}
                className="flex-1 bg-green-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50"
              >
                ✅ 確認驗收，結案
              </button>
              <button
                disabled={busy}
                onClick={() => setShowRejectForm(true)}
                className="flex-1 border border-red-300 text-red-600 font-semibold py-2.5 rounded-xl"
              >
                ↩ 驗收不通過
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="請說明驗收不通過的原因"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || !rejectionNote.trim()}
                  onClick={() =>
                    runAction(() =>
                      apiPost("accept_ticket", { ticket_id: ticket.id, decision: "reject", rejection_note: rejectionNote })
                    )
                  }
                  className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50"
                >
                  送出並退回維修
                </button>
                <button onClick={() => setShowRejectForm(false)} className="px-4 text-sm text-gray-500">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(canCancel || canDelete) && (
        <div className="flex gap-3">
          {canCancel && (
            <button
              disabled={busy}
              onClick={() => runAction(() => apiPost("cancel_ticket", { ticket_id: ticket.id }))}
              className="text-sm text-gray-500 underline"
            >
              取消這筆報修
            </button>
          )}
          {canDelete && (
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("確定要永久刪除這筆報修單嗎？此動作無法復原。")) {
                  runAction(() => apiPost("delete_ticket", { ticket_id: ticket.id })).then(() => navigate("/tickets"));
                }
              }}
              className="text-sm text-red-500 underline"
            >
              🗑 刪除此報修單
            </button>
          )}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold text-sm mb-3">處理紀錄</h2>
        <ol className="space-y-2 text-xs text-gray-500">
          {logs.map((log) => (
            <li key={log.id} className="border-l-2 border-gray-200 pl-3">
              <span className="font-medium text-gray-700">
                {log.from_status ? `${STATUS_LABEL[log.from_status]} → ` : ""}{STATUS_LABEL[log.to_status]}
              </span>
              {" · "}{log.changed_by?.display_name ?? "系統"}
              {" · "}{new Date(log.created_at).toLocaleString("zh-TW")}
              {log.note && <div className="text-gray-400">{log.note}</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
