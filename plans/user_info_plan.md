# User Info Plan

## Overview

Replace the hardcoded "Autodesk User" placeholder in the header with the authenticated user's real name and avatar, fetched from the APS userinfo endpoint immediately after login and on page reload (when an existing token is restored).

---

## API Reference

### Endpoint

```
GET https://developer.api.autodesk.com/userinfo
Authorization: Bearer <access_token>
```

Standard OIDC userinfo endpoint. Requires the token to have been issued with the `openid` and `profile` scopes. The current app scope (`data:read data:write`) does not include these — see Phase 1.

### Response fields used

| Field | Type | Used for |
|-------|------|----------|
| `sub` | string | Unique user ID (replaces current stub `'user'`) |
| `name` | string | Full display name shown in header |
| `picture` | string | URL of profile avatar image |
| `email` | string | Optional — stored on User for future use |
| `given_name` | string | Stored — fallback initials if `picture` fails |
| `family_name` | string | Stored — fallback initials if `picture` fails |

Other fields returned (`locale`, `company`, `job_title`, `country_code`, etc.) are available but not used in this phase.

---

## Current State

- **`VITE_SCOPE`** in `.env`: `data:read data:write` — missing `openid profile email`
- **`src/types/auth.types.ts`**: `User` has `id?`, `name?`, `email?` — no `picture`
- **`src/context/AuthContext.tsx`**: Two `TODO: Fetch user info` stubs both call `setUser({ id: 'user', name: 'Autodesk User' })`
- **`src/components/auth/LogoutButton.tsx`**: Renders `user.name` as plain `Typography` — no avatar
- **`src/components/layout/Header.tsx`**: Delegates user display entirely to `<LogoutButton />`

---

## Files

### Modified Files

#### `.env.example`
Add `openid profile email` to the scope:
```
VITE_SCOPE=data:read data:write openid profile email
```
> **Note**: The developer must also update their local `.env` file and re-authenticate to get a token issued with the new scopes.

#### `src/types/auth.types.ts`
Extend the `User` interface to carry all fields returned from userinfo:
```ts
export interface User {
  id?: string           // sub
  name?: string         // name
  email?: string        // email
  picture?: string      // picture (avatar URL)
  givenName?: string    // given_name
  familyName?: string   // family_name
}
```

#### `src/context/AuthContext.tsx`
- Import and call `fetchUserInfo` (new service, below) in both places where `setUser` is called:
  1. **On mount** (when `TokenManager.getToken()` finds an existing token)
  2. **In `handleAuthSuccess`** (immediately after a successful OAuth callback)
- Both calls are `async` — wrap the mount `useEffect` body with an `async` IIFE, and `handleAuthSuccess` is already in an async context.
- **Token restore failure → force re-login**: if `fetchUserInfo` fails on mount (most likely cause: a stored token missing `openid profile email` scopes), clear the token locally and set `isAuthenticated: false`. The protected route will redirect to the home/login page. This avoids silently leaving the user with a stub name and no indication that re-authentication is needed. Do **not** call `authService.logout()` (which bounces through the Autodesk logout URL) — just clear local state cleanly.
- **Fresh login failure → silent fallback**: if `fetchUserInfo` fails inside `handleAuthSuccess` (token was just issued moments ago), fall back to the stub. A scope error is very unlikely here since the scopes are controlled by the app; the failure is more likely a transient network issue, and forcing a re-login would risk a redirect loop.

```ts
// In the mount useEffect — force re-login on failure:
const token = TokenManager.getToken()
if (token) {
  try {
    const userInfo = await fetchUserInfo(token)
    setAccessToken(token)
    setIsAuthenticated(true)
    setUser(userInfo)
  } catch {
    // Token is stale or missing required scopes — clear it so the user
    // re-authenticates with the correct scopes on next login.
    TokenManager.clearToken()
    // Leave isAuthenticated: false — ProtectedRoute redirects to home.
  }
}
setLoading(false)

// In handleAuthSuccess — silent fallback (token was just issued):
setAccessToken(token)
setIsAuthenticated(true)
setError(null)
try {
  const userInfo = await fetchUserInfo(token)
  setUser(userInfo)
} catch {
  setUser({ id: 'user', name: 'Autodesk User' })
}
```

#### `src/components/auth/LogoutButton.tsx`
Replace the plain `Typography` name display with an MUI `Avatar` + name combination:

```tsx
{user && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Avatar
      src={user.picture}
      alt={user.name}
      sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
    >
      {/* Initials fallback when picture is absent or fails to load */}
      {getInitials(user)}
    </Avatar>
    <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
      {user.name}
    </Typography>
  </Box>
)}
```

`getInitials(user)` is a small helper defined in the same file:
```ts
function getInitials(user: User): string {
  if (user.givenName && user.familyName) {
    return `${user.givenName[0]}${user.familyName[0]}`.toUpperCase()
  }
  return user.name?.[0]?.toUpperCase() ?? '?'
}
```

### New Files

#### `src/services/auth/userInfoService.ts`
A single exported function that calls the userinfo endpoint and maps the response to `User`:

```ts
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
```

---

## Implementation Phases

### Phase 1 — Scope & types
- Add `openid profile email` to `VITE_SCOPE` in `.env.example`
- Add `picture`, `givenName`, `familyName` fields to `User` in `src/types/auth.types.ts`

### Phase 2 — User info service
- Create `src/services/auth/userInfoService.ts` with `fetchUserInfo`

### Phase 3 — AuthContext integration
- Update both `setUser` stubs in `AuthContext.tsx` to call `fetchUserInfo`
- **On mount failure**: clear token locally, leave `isAuthenticated: false` → protected route redirects to login
- **On handleAuthSuccess failure**: silent fallback to stub (prevents redirect loop)

### Phase 4 — Avatar in header
- Update `LogoutButton.tsx` to render MUI `Avatar` + initials fallback + name

### Phase 5 — Verify
- Log in fresh: confirm name and avatar appear in header
- Reload page: confirm token restore triggers userinfo fetch (name/avatar persist)
- Stale token (missing scopes): confirm app clears token and redirects to login instead of showing stub name
- Network error on fresh login: confirm fallback "Autodesk User" appears without crash or redirect loop
- Avatar `src` 404 (broken image): confirm initials render correctly
- Narrow viewport (xs): confirm name is hidden but avatar remains visible

---

## Non-goals (this phase)

- No user profile editing
- No email display in the header (stored on `User` but not rendered)
- No signed URL expiry handling for the avatar URL
- No tooltip on hover showing full user details
