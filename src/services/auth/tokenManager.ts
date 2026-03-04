/**
 * Token Manager
 * Handles secure storage and retrieval of OAuth tokens
 */

import { TokenResponse } from '../../types/auth.types'

const TOKEN_KEY = 'aps_access_token'
const TOKEN_EXPIRY_KEY = 'aps_token_expiry'

export class TokenManager {
  /**
   * Store access token and expiration time
   */
  static setToken(tokenResponse: TokenResponse): void {
    const { access_token, expires_in } = tokenResponse

    // Calculate expiration timestamp
    const expiryTime = Date.now() + expires_in * 1000

    // Store in sessionStorage (cleared when tab closes)
    sessionStorage.setItem(TOKEN_KEY, access_token)
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
  }

  /**
   * Get access token if valid
   * Returns null if token doesn't exist or is expired
   */
  static getToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const expiryTime = sessionStorage.getItem(TOKEN_EXPIRY_KEY)

    if (!token || !expiryTime) {
      return null
    }

    // Check if token is expired
    if (Date.now() >= parseInt(expiryTime)) {
      this.clearToken()
      return null
    }

    return token
  }

  /**
   * Check if token exists and is valid
   */
  static hasValidToken(): boolean {
    return this.getToken() !== null
  }

  /**
   * Clear stored token data
   */
  static clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
  }

  /**
   * Get time until token expires (in seconds)
   * Returns 0 if no token or expired
   */
  static getTimeUntilExpiry(): number {
    const expiryTime = sessionStorage.getItem(TOKEN_EXPIRY_KEY)

    if (!expiryTime) {
      return 0
    }

    const remaining = parseInt(expiryTime) - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }
}
