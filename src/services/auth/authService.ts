/**
 * Authentication Service
 * Handles Autodesk APS OAuth 2.0 PKCE flow
 */

import { PKCEHelper } from './pkceHelper'
import { TokenResponse, AuthConfig } from '../../types/auth.types'

export class AuthService {
  private config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * Initiate PKCE login flow
   * Redirects user to Autodesk authorization server
   */
  async login(): Promise<void> {
    // Generate PKCE parameters
    const codeVerifier = PKCEHelper.generateCodeVerifier()
    const codeChallenge = await PKCEHelper.generateCodeChallenge(codeVerifier)
    const state = PKCEHelper.generateState()

    // Store for later use in callback
    sessionStorage.setItem('pkce_code_verifier', codeVerifier)
    sessionStorage.setItem('pkce_auth_state', state)

    // Build authorization URL for Autodesk APS
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authUrl = `${this.config.authUrl}?${params.toString()}`

    // Redirect to authorization server
    window.location.href = authUrl
  }

  /**
   * Handle authorization callback
   * Validates state and exchanges code for token
   */
  async handleCallback(callbackUrl: string): Promise<TokenResponse> {
    const params = new URLSearchParams(new URL(callbackUrl).search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Check for authorization errors
    if (error) {
      throw new Error(`Authorization failed: ${error} - ${errorDescription || 'Unknown error'}`)
    }

    // Validate state parameter (CSRF protection)
    const storedState = sessionStorage.getItem('pkce_auth_state')
    if (!state || state !== storedState) {
      throw new Error('Invalid state parameter - possible CSRF attack')
    }

    // Get stored code verifier
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier')
    if (!code || !codeVerifier) {
      throw new Error('Missing authorization code or verifier')
    }

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier)

    // Clean up stored PKCE parameters
    sessionStorage.removeItem('pkce_code_verifier')
    sessionStorage.removeItem('pkce_auth_state')

    return tokenResponse
  }

  /**
   * Exchange authorization code for access token with Autodesk APS
   * Uses application/x-www-form-urlencoded as required by Autodesk
   */
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.redirectUri,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Token exchange failed: ${errorData.error || response.statusText} - ${
          errorData.error_description || 'Unknown error'
        }`
      )
    }

    return response.json()
  }

  /**
   * Logout user from Autodesk APS
   * Clears local session and redirects to Autodesk logout
   */
  logout(): void {
    // Clear all session storage
    sessionStorage.clear()

    // Redirect to Autodesk logout endpoint
    const logoutUrl = 'https://developer.api.autodesk.com/authentication/v2/logout'
    const params = new URLSearchParams({
      post_logout_redirect_uri: window.location.origin,
    })

    window.location.href = `${logoutUrl}?${params.toString()}`
  }
}
