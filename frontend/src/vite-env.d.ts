/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_FUNCTIONS_URL: string;
  readonly VITE_LINE_LOGIN_CHANNEL_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
