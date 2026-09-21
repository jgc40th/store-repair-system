const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getSessionToken(): string | null {
  return localStorage.getItem("session_token");
}

export function clearSession() {
  localStorage.removeItem("session_token");
  localStorage.removeItem("app_user");
}

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
    }
    throw new ApiError(data.error ?? `發生錯誤 (${res.status})`, res.status);
  }
  return data;
}

/** 呼叫需要登入的 /api Edge Function，method=POST。 */
export async function apiPost<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${FUNCTIONS_URL}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  return handleResponse(res) as Promise<T>;
}

/** 呼叫需要登入的 /api Edge Function，method=GET。 */
export async function apiGet<T = unknown>(
  action: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const token = getSessionToken();
  const search = new URLSearchParams({ action });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }
  const res = await fetch(`${FUNCTIONS_URL}/api?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleResponse(res) as Promise<T>;
}

/** 呼叫 LINE 登入交換用的 Edge Function（不需要 Authorization header）。 */
export async function lineLoginExchange(code: string, redirectUri: string) {
  const res = await fetch(`${FUNCTIONS_URL}/line-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  return handleResponse(res);
}
