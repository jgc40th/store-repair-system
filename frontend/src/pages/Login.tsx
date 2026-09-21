import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildLineLoginUrl } from "../lib/lineLogin";

export default function Login() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Navigate to="/tickets" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-soft px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="text-4xl mb-3">🏨</div>
        <h1 className="text-xl font-bold mb-1">設備線上報修系統</h1>
        <p className="text-sm text-gray-500 mb-6">連鎖汽車旅館內部維修派工平台</p>
        <a
          href={buildLineLoginUrl()}
          className="block w-full bg-[#06C755] hover:opacity-90 text-white font-semibold py-3 rounded-xl transition"
        >
          以 LINE 帳號登入
        </a>
        <p className="text-xs text-gray-400 mt-4">
          登入前請先加入本系統 LINE 官方帳號為好友，才能收到報修通知。
        </p>
      </div>
    </div>
  );
}
