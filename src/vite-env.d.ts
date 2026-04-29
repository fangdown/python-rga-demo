/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAG_BASE_URL?: string
  readonly VITE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
