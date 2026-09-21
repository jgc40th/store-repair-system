import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types";

export default function ProtectedRoute({
  children,
  allow,
}: {
  children: JSX.Element;
  allow?: Role[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "unassigned") {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl border text-center">
        <p className="text-lg font-semibold mb-2">帳號尚未啟用</p>
        <p className="text-gray-600 text-sm">
          您的帳號已成功以 LINE 登入，但尚未由系統管理員指派角色，暫時無法使用系統功能。
          請聯絡系統管理員將您加入為分館人員、總務窗口人員或工務人員。
        </p>
      </div>
    );
  }
  if (allow && !allow.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl border text-center">
        <p className="text-lg font-semibold mb-2">沒有權限</p>
        <p className="text-gray-600 text-sm">您的身份無法使用此頁面。</p>
      </div>
    );
  }
  return children;
}
