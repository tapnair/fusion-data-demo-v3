/**
 * Application Constants
 */

export const API_ENDPOINTS = {
  GRAPHQL: import.meta.env.VITE_GRAPHQL_ENDPOINT,
  AUTH_URL: import.meta.env.VITE_AUTH_URL,
  TOKEN_URL: import.meta.env.VITE_TOKEN_URL,
}

export const AUTH_CONFIG = {
  CLIENT_ID: import.meta.env.VITE_CLIENT_ID,
  REDIRECT_URI: import.meta.env.VITE_REDIRECT_URI,
  SCOPE: import.meta.env.VITE_SCOPE,
}

// Enable debug logging
export const DEBUG = true
