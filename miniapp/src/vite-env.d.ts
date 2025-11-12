/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_STICKER_PROCESSOR_URL?: string
  readonly VITE_STICKER_PROCESSOR_PATH?: string
  readonly VITE_STICKER_PROCESSOR_PROXY_TARGET?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

