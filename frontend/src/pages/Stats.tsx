import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { STATUS_LABEL, TicketStatus } from "../types";

interface StatsResponse {
  status_counts: Record<TicketStatus, number>;
  archived_count: number;
}

export default function Stats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    apiGet<StatsResponse>("stats").then(setStats);
  }, []);

  if (!stats) return <p className="text-center text-gray-400 py-10">載入中…</p>;

  const order: TicketStatus[] = ["pending", "assigned", "pending_review", "completed", "cancelled"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-5">統計儀表板</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {order.map((s) => (
          <div key={s} className="bg-white border rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-brand">{stats.status_counts[s] ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">{STATUS_LABEL[s]}</div>
          </div>
        ))}
        <div className="bg-white border rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{stats.archived_count}</div>
          <div className="text-xs text-gray-500 mt-1">已封存</div>
        </div>
      </div>
    </div>
  );
}
