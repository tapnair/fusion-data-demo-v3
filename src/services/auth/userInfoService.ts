import type { User } from '../../types/auth.types'

const USERINFO_URL = 'https://developer.api.autodesk.com/userinfo'

export async function fetchUserInfo(accessToken: string): Promise<User> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Userinfo request failed: ${response.status}`)
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
