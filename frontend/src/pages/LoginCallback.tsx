import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { lineLoginExchange } from "../lib/api";
import { getRedirectUri, verifyState } from "../lib/lineLogin";

export default function LoginCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const lineError = params.get("error");

    if (lineError) {
      setError("登入已取消或授權失敗。");
      return;
    }
    if (!code || !state || !verifyState(state)) {
      setError("登入驗證失敗，請重新登入。");
      return;
    }

    lineLoginExchange(code, getRedirectUri())
      .then((data: any) => {
        login(data.session_token, data.user);
        navigate("/tickets", { replace: true });
      })
      .catch((err) => {
        setError(err.message ?? "登入失敗，請再試一次。");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <a href="/login" className="text-brand underline text-sm">
            回登入頁重試
          </a>
        </div>
      ) : (
        <p className="text-gray-500">登入中，請稍候…</p>
      )}
    </div>
  );
}
