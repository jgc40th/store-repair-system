const LINE_CHANNEL_ID = Deno.env.get("LINE_LOGIN_CHANNEL_ID")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET")!;
const LINE_MESSAGING_ACCESS_TOKEN = Deno.env.get(
  "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"
)!;

export type LineProfile = {
  sub: string; // LINE userId
  name: string;
  picture?: string;
};

/**
 * 用 LINE Login 的 authorization code 換取 access_token / id_token，
 * 並直接用 LINE 官方的 verify 端點解出使用者資料（不需要自行驗證 JWT 簽章）。
 */
export async function exchangeLineLogin(
  code: string,
  redirectUri: string
): Promise<LineProfile> {
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`LINE token exchange failed: ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();

  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: tokenData.id_token,
      client_id: LINE_CHANNEL_ID,
    }),
  });

  if (!verifyRes.ok) {
    throw new Error(`LINE id_token verify failed: ${await verifyRes.text()}`);
  }

  const payload = await verifyRes.json();
  return { sub: payload.sub, name: payload.name, picture: payload.picture };
}

/** 呼叫 LINE Messaging API 推播一則文字訊息給指定使用者。 */
export async function pushLineMessage(lineUserId: string, text: string) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_MESSAGING_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      console.error("LINE push failed:", lineUserId, await res.text());
    }
  } catch (err) {
    // 通知失敗不應該讓整個 API 動作失敗（例如使用者封鎖官方帳號、額度用盡）
    console.error("LINE push error:", lineUserId, err);
  }
}

/** 一次推播給多個使用者（略過沒有 line_user_id 的情況）。 */
export async function pushLineMessageToMany(
  lineUserIds: (string | null | undefined)[],
  text: string
) {
  const targets = lineUserIds.filter((id): id is string => !!id);
  await Promise.all(targets.map((id) => pushLineMessage(id, text)));
}
