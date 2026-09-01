import { fetchUserInfo, UserInfoError } from './userInfoService'

const PROFILE = {
  sub: 'XN39L6WCKZ3X',
  name: 'First Last',
  given_name: 'First',
  family_name: 'Last',
  email: 'test@test.com',
  picture: 'https://images.profile.autodesk.com/hash/x120.jpg',
}

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('fetchUserInfo()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the OIDC response onto the User shape', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve(PROFILE) })

    await expect(fetchUserInfo('tok')).resolves.toEqual({
      id: PROFILE.sub,
      name: PROFILE.name,
      email: PROFILE.email,
      picture: PROFILE.picture,
      givenName: PROFILE.given_name,
      familyName: PROFILE.family_name,
    })
  })

  it('sends the token as a Bearer credential', async () => {
    const fn = mockFetch({ ok: true, json: () => Promise.resolve(PROFILE) })

    await fetchUserInfo('tok')

    expect(fn).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: 'Bearer tok' },
    })
  })

  // The 403 case is the one that previously caused an infinite login loop: APS
  // rejects /userinfo when the token lacks the mandatory `openid` scope, even
  // though the token is otherwise valid. AuthContext keys off `status` to decide
  // whether to discard the token, so the status must survive being thrown.
  it.each([401, 403, 429, 500])('throws UserInfoError carrying status %i', async (status) => {
    mockFetch({ ok: false, status })

    await expect(fetchUserInfo('tok')).rejects.toMatchObject({
      name: 'UserInfoError',
      status,
    })
  })

  it('throws an error that is instanceof UserInfoError', async () => {
    mockFetch({ ok: false, status: 403 })

    await expect(fetchUserInfo('tok')).rejects.toBeInstanceOf(UserInfoError)
  })
})
