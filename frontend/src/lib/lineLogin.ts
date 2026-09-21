const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID as string;

export function getRedirectUri(): string {
  return `${window.location.origin}/login/callback`;
}

function randomState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 產生 LINE Login 授權網址，並把 state 存到 sessionStorage 供之後比對，防止 CSRF。 */
export function buildLineLoginUrl(): string {
  const state = randomState();
  sessionStorage.setItem("line_login_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINE_CHANNEL_ID,
    redirect_uri: getRedirectUri(),
    state,
    scope: "openid profile",
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

export function verifyState(returnedState: string): boolean {
  const saved = sessionStorage.getItem("line_login_state");
  sessionStorage.removeItem("line_login_state");
  return !!saved && saved === returnedState;
}
