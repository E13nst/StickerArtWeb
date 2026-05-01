/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  /** Числовой id blueprint из GET …/user-preset-creation-blueprints; если не задан — первый по id в ответе */
  readonly VITE_USER_PRESET_CREATION_BLUEPRINT_ID?: string
  readonly VITE_STICKER_PROCESSOR_URL?: string
  readonly VITE_STICKER_PROCESSOR_PATH?: string
  readonly VITE_STICKER_PROCESSOR_PROXY_TARGET?: string
  /**
   * Кастомный путь multipart-загрузки для слота preset_ref на sticker-processor.
   * Если не задан — используется /images/upload и поле preset_style_reference=true.
   */
  readonly VITE_PRESET_REF_UPLOAD_PATH?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

