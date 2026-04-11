import { PKCEHelper } from './pkceHelper'

// Valid base64url alphabet (no padding, no +, no /)
const BASE64URL_RE = /^[A-Za-z0-9\-_.~]*$/

describe('PKCEHelper', () => {
  // ─── generateCodeVerifier() ──────────────────────────────────────────────────

  describe('generateCodeVerifier()', () => {
    it('returns a string', () => {
      expect(typeof PKCEHelper.generateCodeVerifier()).toBe('string')
    })

    it('produces the expected length (base64url of 32 bytes = 43 chars, no padding)', () => {
      // 32 bytes → 256 bits → ceil(32/3)*4 = 44 base64 chars, minus 1 padding → 43
      const verifier = PKCEHelper.generateCodeVerifier()
      expect(verifier).toHaveLength(43)
    })

    it('only contains valid base64url characters [A-Za-z0-9\\-_.~]', () => {
      const verifier = PKCEHelper.generateCodeVerifier()
      expect(verifier).toMatch(BASE64URL_RE)
    })

    it('does not contain base64 padding characters (=)', () => {
      const verifier = PKCEHelper.generateCodeVerifier()
      expect(verifier).not.toContain('=')
    })

    it('does not contain standard base64 + or / characters', () => {
      const verifier = PKCEHelper.generateCodeVerifier()
      expect(verifier).not.toContain('+')
      expect(verifier).not.toContain('/')
    })

    it('produces different values on successive calls (probabilistic uniqueness)', () => {
      const a = PKCEHelper.generateCodeVerifier()
      const b = PKCEHelper.generateCodeVerifier()
      // Collision probability for 32 bytes of random data is astronomically small.
      expect(a).not.toBe(b)
    })
  })

  // ─── generateCodeChallenge() ─────────────────────────────────────────────────

  describe('generateCodeChallenge(verifier)', () => {
    it('returns a Promise', () => {
      const result = PKCEHelper.generateCodeChallenge('some-verifier')
      expect(result).toBeInstanceOf(Promise)
    })

    it('resolves to a string', async () => {
      const challenge = await PKCEHelper.generateCodeChallenge('some-verifier')
      expect(typeof challenge).toBe('string')
    })

    it('only contains valid base64url characters', async () => {
      const verifier = PKCEHelper.generateCodeVerifier()
      const challenge = await PKCEHelper.generateCodeChallenge(verifier)
      expect(challenge).toMatch(BASE64URL_RE)
    })

    it('contains no base64 padding (=)', async () => {
      const challenge = await PKCEHelper.generateCodeChallenge('any-verifier-value')
      expect(challenge).not.toContain('=')
    })

    it('contains no + or / from standard base64', async () => {
      // Run several verifiers to increase the chance of hitting + or / before encoding.
      for (let i = 0; i < 10; i++) {
        const verifier = PKCEHelper.generateCodeVerifier()
        const challenge = await PKCEHelper.generateCodeChallenge(verifier)
        expect(challenge).not.toContain('+')
        expect(challenge).not.toContain('/')
      }
    })

    it('produces a deterministic challenge for the same verifier', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const c1 = await PKCEHelper.generateCodeChallenge(verifier)
      const c2 = await PKCEHelper.generateCodeChallenge(verifier)
      expect(c1).toBe(c2)
    })

    it('produces different challenges for different verifiers', async () => {
      const v1 = PKCEHelper.generateCodeVerifier()
      const v2 = PKCEHelper.generateCodeVerifier()
      const [c1, c2] = await Promise.all([
        PKCEHelper.generateCodeChallenge(v1),
        PKCEHelper.generateCodeChallenge(v2),
      ])
      expect(c1).not.toBe(c2)
    })

    it('produces the correct SHA-256 base64url challenge for a known verifier', async () => {
      // RFC 7636 example: verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      // SHA-256 → base64url = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const challenge = await PKCEHelper.generateCodeChallenge(verifier)
      expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    })
  })

  // ─── generateState() ──────────────────────────────────────────────────────────

  describe('generateState()', () => {
    it('returns a string', () => {
      expect(typeof PKCEHelper.generateState()).toBe('string')
    })

    it('only contains valid base64url characters', () => {
      const state = PKCEHelper.generateState()
      expect(state).toMatch(BASE64URL_RE)
    })

    it('contains no base64 padding (=)', () => {
      const state = PKCEHelper.generateState()
      expect(state).not.toContain('=')
    })

    it('produces the expected length (base64url of 16 bytes = 22 chars, no padding)', () => {
      // 16 bytes → ceil(16/3)*4 = 24 base64 chars, minus 2 padding → 22
      const state = PKCEHelper.generateState()
      expect(state).toHaveLength(22)
    })

    it('produces different values on successive calls (probabilistic uniqueness)', () => {
      const a = PKCEHelper.generateState()
      const b = PKCEHelper.generateState()
      expect(a).not.toBe(b)
    })
  })
})
