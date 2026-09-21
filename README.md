# 連鎖汽車旅館 設備線上報修系統

RWD 前端（可加到手機主畫面的 PWA）＋ Supabase（PostgreSQL + Edge Functions）後端，
搭配 LINE Login 登入與 LINE Messaging API 通知。全部使用免費雲端資源即可上線。

```
repair-system/
├── frontend/                 # Vite + React + Tailwind，部署到 Vercel
├── supabase/
│   ├── sql/                  # 資料表、RLS、排程 SQL（依序在 Supabase SQL Editor 執行）
│   └── functions/            # Edge Functions（後端 API）
│       ├── line-login/       # LINE 登入交換
│       ├── api/               # 主要業務 API（報修單/分館/帳號/統計）
│       ├── cron-archive/     # 排程：封存超過 12 個月的已完成報修單
│       └── ping/             # 給 keepalive 用的輕量端點
└── .github/workflows/keepalive.yml   # 定期喚醒 Supabase 專案，避免免費方案自動暫停
```

## 一、建立 Supabase 專案

1. 到 https://supabase.com 建立免費專案。
2. 打開 SQL Editor，依序執行：
   1. `supabase/sql/01_schema.sql`
   2. `supabase/sql/02_policies.sql`
   3. `supabase/sql/03_cron.sql`（先把檔案內的 `<PROJECT_REF>`、`<SERVICE_ROLE_KEY>` 換成你自己的值；
      也可以先跳過這步，等後面部署好 Edge Function 再回來執行）
3. 到 Database → Extensions 確認 `pg_cron`、`pg_net`、`pgcrypto` 都已啟用（SQL 已包含 `create extension if not exists`，多數情況會自動啟用）。
4. 在 Table Editor 或用 SQL 手動新增第一批分館，例如：
   ```sql
   insert into branches (name) values ('台北南港館'), ('台中崇德館'), ('高雄左營館');
   ```

## 二、申請 LINE 串接

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立一個 **Provider**。
2. 建立一個 **LINE Login** channel：
   - 取得 `Channel ID`、`Channel secret`
   - 在 Callback URL 填入：`https://<你的 Vercel 網域>/login/callback`
3. 建立一個 **Messaging API** channel（作為官方帳號，用來發送通知）：
   - 取得 `Channel access token`（長期）
   - 記下官方帳號的 LINE ID，之後給使用者加好友用

## 三、部署 Edge Functions

安裝 Supabase CLI 後，在專案根目錄執行：

```bash
supabase login
supabase link --project-ref <你的 PROJECT_REF>

# 設定 Edge Function 會用到的環境變數（Secrets）
supabase secrets set \
  LINE_LOGIN_CHANNEL_ID=xxxx \
  LINE_LOGIN_CHANNEL_SECRET=xxxx \
  LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=xxxx \
  ALLOWED_ORIGIN=https://<你的 Vercel 網域>

# 部署所有 Edge Functions
supabase functions deploy line-login
supabase functions deploy api
supabase functions deploy cron-archive
supabase functions deploy ping
```

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 這兩個變數 Supabase 平台會自動注入給
Edge Functions，不需要自己額外設定。

部署完成後，回到 `supabase/sql/03_cron.sql`，把裡面的 `<PROJECT_REF>` 與
`<SERVICE_ROLE_KEY>`（Project Settings → API → service_role）換成正確的值後執行。

## 四、設定 GitHub Actions Keepalive

1. 把整個專案推上 GitHub。
2. 到 repo 的 Settings → Secrets and variables → Actions，新增：
   - `SUPABASE_PING_URL` = `https://<PROJECT_REF>.functions.supabase.co/ping`
3. `.github/workflows/keepalive.yml` 會每 3 天自動呼叫一次，避免 Supabase 免費專案
   因 7 天無流量被自動暫停（也可以在 Actions 頁面手動觸發 `workflow_dispatch` 測試）。

## 五、部署前端到 Vercel

1. 到 https://vercel.com 用 GitHub 帳號登入，選擇這個 repo，
   Root Directory 設為 `frontend`。
2. 在 Vercel 專案的 Environment Variables 新增：
   - `VITE_SUPABASE_FUNCTIONS_URL` = `https://<PROJECT_REF>.functions.supabase.co`
   - `VITE_LINE_LOGIN_CHANNEL_ID` = 你的 LINE Login Channel ID
3. Build Command 使用預設的 `npm run build`，Output Directory 使用預設的 `dist`。
4. 部署完成後拿到網域（例如 `https://your-app.vercel.app`），回頭到：
   - LINE Login channel 的 Callback URL 更新為 `https://your-app.vercel.app/login/callback`
   - Supabase secrets 的 `ALLOWED_ORIGIN` 更新為這個網域，並重新部署 `api`、`line-login`
     兩個 Edge Function（`supabase functions deploy api` / `line-login`）

## 六、加到手機主畫面（PWA 安裝）

前端已內建 PWA 設定（`manifest.webmanifest` + Service Worker，由 `vite-plugin-pwa` 產生）。

- **Android（Chrome）**：開啟網站 → 右上角選單 →「新增至主畫面」／會自動跳出安裝提示。
- **iPhone（Safari）**：開啟網站 → 分享 →「加入主畫面」（iOS 需用 Safari 開啟才能安裝 PWA，
  若使用者是從 LINE 訊息點連結進來，記得提醒他們用瀏覽器打開，而不是停留在 LINE 內建瀏覽器）。

安裝後會以獨立 App 的外觀開啟（無瀏覽器網址列），圖示、名稱皆已預先設定好
（可到 `frontend/public/icons/` 換成正式的品牌圖示）。

## 七、初始管理員帳號設定

系統沒有預設管理員，第一個人需要用資料庫手動指定：

1. 用你自己的 LINE 帳號登入系統一次（此時角色會是 `unassigned`，畫面會顯示「帳號尚未啟用」）。
2. 到 Supabase Table Editor 打開 `app_users`，把你那筆資料的 `role` 改成 `admin`。
3. 重新整理網頁即可看到系統管理員完整功能，之後新增其他人的角色都可以直接在
   「帳號管理」頁面操作，不需要再手動改資料庫。

## 八、本機開發

```bash
cd frontend
npm install
cp .env.example .env.local   # 填入你的 Supabase Functions URL 與 LINE Login Channel ID
npm run dev
```

## 安全性設計摘要

- 前端**不**持有任何 Supabase API Key，所有資料存取都經過 Edge Functions。
- 所有資料表皆啟用 Row Level Security，且未對 `anon` / `authenticated` 開放任何政策
  （唯一例外：公開讀取已啟用分館名稱），即使外流也讀不到任何機敏資料。
- Edge Functions 使用自訂 `sessions` 資料表核發的 token（非 Supabase Auth JWT），
  每支需要登入的函式都會先驗證 token 有效性與角色權限，再執行對應動作。
- LINE 登入以官方 `/oauth2/v2.1/verify` 端點驗證 `id_token`，不在前端信任任何未經驗證的使用者資料。
- `cron-archive` 端點只信任帶有正確 `service_role key` 的呼叫（即只有 pg_cron 排程能觸發）。
