import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchErpMaterial, ErpAuthError, type ErpMaterial } from './erpClient'

const ENDPOINT = 'https://example.com/api/material/byModelId'

const sampleMaterial: ErpMaterial = {
  modelId: 'm1',
  matnr: 'MAT-0001',
  maktx: 'Sample Material',
  meins: 'EA',
  mtart: 'FERT',
  werks: 'P100',
  mmsta: 'ACTIVE',
  beskz: 'E',
  dismm: 'PD',
  plifz: 10,
  eisbe: 5,
  stprs: 12.34,
  waers: 'USD',
  bestand: 42,
  vendor: { lifnr: 'V1', name: 'Acme' },
  lastUpdated: '2026-01-01T00:00:00Z',
}

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

beforeEach(() => {
  vi.stubEnv('VITE_ERP_ENDPOINT_URL', ENDPOINT)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('fetchErpMaterial', () => {
  it('resolves to the parsed material on 200 OK', async () => {
    mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleMaterial,
    })

    const result = await fetchErpMaterial('m1', 'token')
    expect(result).toEqual(sampleMaterial)
  })

  it('resolves to null on 404', async () => {
    mockFetchOnce({ status: 404, ok: false })

    const result = await fetchErpMaterial('missing', 'token')
    expect(result).toBeNull()
  })

  it('rejects with ErpAuthError on 401', async () => {
    mockFetchOnce({ status: 401, ok: false })

    await expect(fetchErpMaterial('m1', 'bad-token')).rejects.toBeInstanceOf(
      ErpAuthError,
    )
  })

  it('rejects with an Error containing the status on other non-2xx (500)', async () => {
    mockFetchOnce({ status: 500, ok: false, statusText: 'Internal Server Error' })

    await expect(fetchErpMaterial('m1', 'token')).rejects.toThrow(/500/)
  })

  it('constructs the URL with URL-encoded modelId', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleMaterial,
    })

    const modelId = 'a/b+c='
    await fetchErpMaterial(modelId, 'token')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('?modelId=')
    expect(calledUrl).toContain(encodeURIComponent(modelId))
    expect(calledUrl).toBe(`${ENDPOINT}?modelId=${encodeURIComponent(modelId)}`)
  })

  it('includes the Authorization: Bearer <token> header', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleMaterial,
    })

    await fetchErpMaterial('m1', 'my-token-123')

    const options = fetchMock.mock.calls[0][1] as RequestInit
    const headers = options.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token-123')
  })

  it('rejects with an Error mentioning the env var when VITE_ERP_ENDPOINT_URL is missing', async () => {
    vi.stubEnv('VITE_ERP_ENDPOINT_URL', '')
    mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleMaterial,
    })

    await expect(fetchErpMaterial('m1', 'token')).rejects.toThrow(
      /VITE_ERP_ENDPOINT_URL/,
    )
  })

  it('forwards the AbortSignal to fetch', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleMaterial,
    })

    const controller = new AbortController()
    await fetchErpMaterial('m1', 'token', controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})
