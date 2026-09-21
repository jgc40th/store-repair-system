import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { Ticket } from "../types";
import StatusBadge from "../components/StatusBadge";

export default function Archive() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<{ tickets: Ticket[] }>("list_tickets", {
      archived: "true",
      search: search || undefined,
      page: 1,
    })
      .then((data) => setTickets(data.tickets))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">📦 歷史封存紀錄</h1>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋標題"
        className="border rounded-lg px-3 py-2 text-sm w-full mb-4"
      />
      {loading ? (
        <p className="text-gray-400 text-sm">載入中…</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-400 text-sm">目前沒有封存紀錄。</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`} className="block bg-white border rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{t.branch?.name} · {t.category}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
