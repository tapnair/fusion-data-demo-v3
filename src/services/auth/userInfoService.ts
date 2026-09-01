import type { User } from '../../types/auth.types'

const USERINFO_URL = 'https://developer.api.autodesk.com/userinfo'

/**
 * Thrown when /userinfo returns a non-OK response. Carries the HTTP status so
 * callers can tell "the token is dead" (401) apart from "the token is fine but
 * this endpoint refused us" (403 — e.g. missing the mandatory `openid` scope).
 */
export class UserInfoError extends Error {
  constructor(readonly status: number) {
    super(`Userinfo request failed: ${status}`)
    this.name = 'UserInfoError'
  }
}

export async function fetchUserInfo(accessToken: string): Promise<User> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new UserInfoError(response.status)
  }

  const data = await response.json()

  return {
    id: data.sub,
    name: data.name,
    email: data.email,
    picture: data.picture,
    givenName: data.given_name,
    familyName: data.family_name,
  }
}
