import { useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { Branch, Role, ROLE_LABEL } from "../types";

interface Account {
  id: string;
  display_name: string;
  role: Role;
  branch_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

const ROLE_OPTIONS: Role[] = ["unassigned", "branch_staff", "hq_staff", "technician", "admin"];

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [accData, branchData] = await Promise.all([
      apiGet<{ accounts: Account[] }>("list_accounts"),
      apiGet<{ branches: Branch[] }>("list_branches"),
    ]);
    setAccounts(accData.accounts);
    setBranches(branchData.branches);
  }

  useEffect(() => {
    load();
  }, []);

  async function update(id: string, patch: Partial<Pick<Account, "role" | "branch_id" | "is_active">>) {
    setBusyId(id);
    setError(null);
    try {
      await apiPost("update_account", { id, ...patch });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新失敗");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-1">👥 帳號管理</h1>
      <p className="text-sm text-gray-500 mb-4">
        新成員請先請他以 LINE 帳號登入系統一次，登入後才會出現在下方清單中。
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <ul className="space-y-3">
        {accounts.map((a) => (
          <li key={a.id} className="bg-white border rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{a.display_name}</span>
              <button
                disabled={busyId === a.id}
                onClick={() => update(a.id, { is_active: !a.is_active })}
                className={`text-xs px-3 py-1 rounded-full ${
                  a.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {a.is_active ? "啟用中" : "已停用"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={a.role}
                disabled={busyId === a.id}
                onChange={(e) => update(a.id, { role: e.target.value as Role })}
                className="border rounded-lg px-2 py-1 text-xs"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              {a.role === "branch_staff" && (
                <select
                  value={a.branch_id ?? ""}
                  disabled={busyId === a.id}
                  onChange={(e) => update(a.id, { branch_id: e.target.value || null })}
                  className="border rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">請選擇分館</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
