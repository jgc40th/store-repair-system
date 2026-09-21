import { useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { Branch } from "../types";

export default function AdminBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await apiGet<{ branches: Branch[] }>("list_branches");
    setBranches(data.branches);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("create_branch", { name: newName.trim() });
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(b: Branch) {
    setBusy(true);
    try {
      await apiPost("update_branch", { id: b.id, is_active: !b.is_active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">🏨 分館管理</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新分館名稱，例：台中崇德館"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          type="submit"
          className="bg-brand text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          + 新增分館
        </button>
      </form>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <ul className="space-y-2">
        {branches.map((b) => (
          <li key={b.id} className="flex items-center justify-between bg-white border rounded-xl px-4 py-3">
            <span className="text-sm">{b.name}</span>
            <button
              disabled={busy}
              onClick={() => toggleActive(b)}
              className={`text-xs px-3 py-1 rounded-full ${
                b.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {b.is_active ? "啟用中" : "已停用"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
