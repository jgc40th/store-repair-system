import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../types";

const ROLE_TAG_STYLE: Record<string, string> = {
  hq_staff: "bg-amber-100 text-amber-700",
  technician: "bg-green-100 text-green-700",
  admin: "bg-red-100 text-red-700",
};

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/tickets" className="font-bold text-brand">
          🏨 線上報修
        </Link>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link to="/tickets" className="text-gray-700 hover:text-brand">報修清單</Link>
          {(user.role === "branch_staff" || user.role === "hq_staff" || user.role === "admin") && (
            <Link to="/tickets/new" className="text-gray-700 hover:text-brand">+ 新增報修</Link>
          )}
          {(user.role === "hq_staff" || user.role === "admin") && (
            <>
              <Link to="/stats" className="text-gray-700 hover:text-brand">統計</Link>
              <Link to="/archive" className="text-gray-700 hover:text-brand">歷史</Link>
            </>
          )}
          {user.role === "admin" && (
            <>
              <Link to="/admin/branches" className="text-gray-700 hover:text-brand">分館</Link>
              <Link to="/admin/accounts" className="text-gray-700 hover:text-brand">帳號</Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${ROLE_TAG_STYLE[user.role] ?? "bg-gray-100 text-gray-500"}`}>
            {ROLE_LABEL[user.role]}
          </span>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-700">
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
