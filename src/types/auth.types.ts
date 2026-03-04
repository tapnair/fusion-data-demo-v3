// Authentication related types

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface AuthConfig {
  clientId: string
  authUrl: string
  tokenUrl: string
  redirectUri: string
  scope: string
}

export interface User {
  id?: string           // sub
  name?: string         // name
  email?: string        // email
  picture?: string      // picture (avatar URL)
  givenName?: string    // given_name
  familyName?: string   // family_name
}

export interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  user: User | null
  loading: boolean
  error: Error | null
}
