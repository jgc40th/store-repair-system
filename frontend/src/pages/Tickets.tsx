import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { Ticket, TicketStatus, STATUS_LABEL, CATEGORIES } from "../types";
import StatusBadge from "../components/StatusBadge";

const STATUS_FILTERS: (TicketStatus | "all")[] = [
  "all",
  "pending",
  "assigned",
  "pending_review",
  "completed",
  "cancelled",
];

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    apiGet<{ tickets: Ticket[]; total: number }>("list_tickets", {
      page,
      status: status === "all" ? undefined : status,
      category: category || undefined,
      search: search || undefined,
      archived: "false",
    })
      .then((data) => {
        setTickets(data.tickets);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, status, category, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">報修清單</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="搜尋標題"
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
        />
        <select
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">全部類別</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setPage(1);
              setStatus(s);
            }}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              status === s ? "bg-brand text-white border-brand" : "bg-white text-gray-600"
            }`}
          >
            {s === "all" ? "全部" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">載入中…</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-400 text-sm">目前沒有符合條件的報修單。</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets/${t.id}`}
                className="block bg-white border rounded-xl px-4 py-3 hover:border-brand transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t.branch?.name} · {t.category}
                  {t.priority === "urgent" && (
                    <span className="ml-2 text-red-600 font-semibold">🔴 緊急</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-6 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-30"
          >
            上一頁
          </button>
          <span className="text-gray-500">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-30"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
