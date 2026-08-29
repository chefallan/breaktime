/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint that increments and returns the global visit count. Unset = counter disabled. */
  readonly VITE_VISIT_COUNTER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
