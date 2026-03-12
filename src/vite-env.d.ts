/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_SYMMETRIC_LAYOUTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
