/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID: string
  readonly VITE_AUTH_URL: string
  readonly VITE_TOKEN_URL: string
  readonly VITE_REDIRECT_URI: string
  readonly VITE_SCOPE: string
  readonly VITE_GRAPHQL_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
