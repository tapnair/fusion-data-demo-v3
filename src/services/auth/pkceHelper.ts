/**
 * PKCE (Proof Key for Code Exchange) Helper Functions
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow
 */

export class PKCEHelper {
  /**
   * Generate a cryptographically random code verifier
   * Length: 43-128 characters (we use 43 for efficiency)
   * Characters: [A-Z, a-z, 0-9, -, ., _, ~]
   */
  static generateCodeVerifier(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return this.base64URLEncode(array)
  }

  /**
   * Generate code challenge from verifier using SHA-256
   * This is sent to the authorization server
   */
  static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return this.base64URLEncode(new Uint8Array(hash))
  }

  /**
   * Base64 URL encode without padding
   * Converts binary data to URL-safe base64 string
   */
  private static base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer))
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Generate random state for CSRF protection
   * Should be unique for each authorization request
   */
  static generateState(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return this.base64URLEncode(array)
  }
}
