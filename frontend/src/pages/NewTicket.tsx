import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { Branch, CATEGORIES } from "../types";

export default function NewTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [title, setTitle] = useState("");
  const [branchId, setBranchId] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsBranchPicker = user?.role === "hq_staff" || user?.role === "admin";

  useEffect(() => {
    if (needsBranchPicker) {
      apiGet<{ branches: Branch[] }>("list_branches").then((data) =>
        setBranches(data.branches.filter((b) => b.is_active))
      );
    }
  }, [needsBranchPicker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim() || (needsBranchPicker && !branchId)) {
      setError("請填寫必填欄位");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost<{ id: string }>("submit_ticket", {
        title,
        branch_id: needsBranchPicker ? branchId : undefined,
        location_detail: locationDetail || undefined,
        category,
        priority,
        description,
      });
      navigate(`/tickets/${res.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提交失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">新增報修</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">報修標題</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：302號房冷氣不冷"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {needsBranchPicker && (
          <div>
            <label className="block text-sm font-medium mb-1">分館</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">請選擇分館</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">詳細位置（選填）</label>
          <input
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            placeholder="例：302號房、大廳、B1停車場"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">類別</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">優先級</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={priority === "normal"}
                onChange={() => setPriority("normal")}
              />
              普通
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={priority === "urgent"}
                onChange={() => setPriority("urgent")}
              />
              🔴 緊急（影響營運或有安全疑慮）
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">問題說明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交報修單"}
        </button>
      </form>
    </div>
  );
}
