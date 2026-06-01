import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  listNotesByComponent,
  listNotesByAssembly,
  createNote,
  updateNote,
  deleteNote,
  NoteValidationError,
  NoteNotFoundError,
  type Note,
  type CreateNoteInput,
} from './notesClient'

const ENDPOINT = 'https://example.com/api/notes'

const SAMPLE_COMPONENT_URN = 'urn:adsk.wipprod:dm.lineage:abc/def+xyz'
const SAMPLE_F3D_ID = '50d3754d-9629-49e5-b6c1-e05d365e61f6'
const SAMPLE_ROOT_URN = 'urn:adsk.wipprod:dm.lineage:root-xyz'

const sampleNote: Note = {
  id: 'abc123',
  componentLineageUrn: 'urn:adsk.wipprod:dm.lineage:abc',
  componentF3dId: '50d3754d-9629-49e5-b6c1-e05d365e61f6',
  rootLineageUrn: 'urn:adsk.wipprod:dm.lineage:root-xyz',
  componentName: 'Test Component',
  body: 'hello',
  author: 'Patrick',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const sampleInput: CreateNoteInput = {
  componentLineageUrn: 'urn:adsk.wipprod:dm.lineage:abc',
  componentF3dId: '50d3754d-9629-49e5-b6c1-e05d365e61f6',
  rootLineageUrn: 'urn:adsk.wipprod:dm.lineage:root-xyz',
  componentName: 'Test Component',
  body: 'hello',
  author: 'Patrick',
}

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

beforeEach(() => {
  vi.stubEnv('VITE_NOTES_ENDPOINT_BASE', ENDPOINT)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('listNotesByComponent', () => {
  it('builds the URL with componentLineageUrn and componentF3dId and returns results', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [sampleNote], total: 1 }),
    })

    const result = await listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)

    expect(result).toEqual([sampleNote])
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(
      `${ENDPOINT}?componentLineageUrn=${encodeURIComponent(SAMPLE_COMPONENT_URN)}&componentF3dId=${encodeURIComponent(SAMPLE_F3D_ID)}`
    )
    const options = fetchMock.mock.calls[0][1] as RequestInit | undefined
    expect(options?.method).toBeUndefined()
  })

  it('URL-encodes both componentLineageUrn and componentF3dId', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    })

    await listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain(`componentLineageUrn=${encodeURIComponent(SAMPLE_COMPONENT_URN)}`)
    expect(calledUrl).toContain(`componentF3dId=${encodeURIComponent(SAMPLE_F3D_ID)}`)
    // Verify special chars in URN are encoded
    expect(calledUrl).not.toContain('abc/def+xyz')
  })

  it('returns an empty array on 404', async () => {
    mockFetchOnce({ status: 404, ok: false })
    const result = await listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)
    expect(result).toEqual([])
  })

  it('throws on non-2xx (500)', async () => {
    mockFetchOnce({ status: 500, ok: false, statusText: 'Internal Server Error' })
    await expect(
      listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)
    ).rejects.toThrow(/500/)
  })

  it('throws NoteValidationError on 400 with fieldErrors', async () => {
    mockFetchOnce({
      status: 400,
      ok: false,
      json: async () => ({
        error: 'Validation failed',
        fieldErrors: { componentF3dId: 'required' },
      }),
    })

    let caught: unknown
    try {
      await listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(NoteValidationError)
    expect((caught as NoteValidationError).fieldErrors).toEqual({ componentF3dId: 'required' })
  })

  it('forwards the AbortSignal', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    })

    const controller = new AbortController()
    await listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID, controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})

describe('listNotesByAssembly', () => {
  it('builds the URL with rootLineageUrn and returns results', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [sampleNote], total: 1 }),
    })

    const result = await listNotesByAssembly(SAMPLE_ROOT_URN)

    expect(result).toEqual([sampleNote])
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(`${ENDPOINT}?rootLineageUrn=${encodeURIComponent(SAMPLE_ROOT_URN)}`)
  })

  it('returns an empty array on 404', async () => {
    mockFetchOnce({ status: 404, ok: false })
    const result = await listNotesByAssembly('missing')
    expect(result).toEqual([])
  })

  it('forwards the AbortSignal', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    })

    const controller = new AbortController()
    await listNotesByAssembly(SAMPLE_ROOT_URN, controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})

describe('createNote', () => {
  it('POSTs JSON to the base URL with all 6 fields and returns the created note', async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      ok: true,
      json: async () => sampleNote,
    })

    const result = await createNote(sampleInput)

    expect(result).toEqual(sampleNote)
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(ENDPOINT)
    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.method).toBe('POST')
    const headers = options.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    const parsedBody = JSON.parse(options.body as string)
    expect(parsedBody).toEqual(sampleInput)
    expect(parsedBody).toEqual({
      componentLineageUrn: 'urn:adsk.wipprod:dm.lineage:abc',
      componentF3dId: '50d3754d-9629-49e5-b6c1-e05d365e61f6',
      rootLineageUrn: 'urn:adsk.wipprod:dm.lineage:root-xyz',
      componentName: 'Test Component',
      body: 'hello',
      author: 'Patrick',
    })
  })

  it('throws NoteValidationError on 400 with fieldErrors attached', async () => {
    mockFetchOnce({
      status: 400,
      ok: false,
      json: async () => ({
        error: 'Validation failed',
        fieldErrors: { body: 'required' },
      }),
    })

    let caught: unknown
    try {
      await createNote(sampleInput)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(NoteValidationError)
    expect((caught as NoteValidationError).fieldErrors).toEqual({ body: 'required' })
    expect((caught as NoteValidationError).message).toBe('Validation failed')
  })

  it('throws a generic Error on non-2xx other than 400', async () => {
    mockFetchOnce({ status: 500, ok: false, statusText: 'Internal Server Error' })
    await expect(createNote(sampleInput)).rejects.toThrow(/500/)
  })

  it('forwards the AbortSignal', async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      ok: true,
      json: async () => sampleNote,
    })

    const controller = new AbortController()
    await createNote(sampleInput, controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})

describe('updateNote', () => {
  it('PATCHes to <base>/<id> with the body and returns the updated note', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ ...sampleNote, body: 'updated' }),
    })

    const result = await updateNote('abc123', 'updated')

    expect(result.body).toBe('updated')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(`${ENDPOINT}/abc123`)
    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.method).toBe('PATCH')
    const headers = options.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body as string)).toEqual({ body: 'updated' })
  })

  it('URL-encodes the id', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleNote,
    })

    await updateNote('a/b', 'x')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(`${ENDPOINT}/${encodeURIComponent('a/b')}`)
  })

  it('throws NoteNotFoundError on 404', async () => {
    mockFetchOnce({ status: 404, ok: false })
    await expect(updateNote('missing', 'x')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('throws NoteValidationError on 400 with fieldErrors', async () => {
    mockFetchOnce({
      status: 400,
      ok: false,
      json: async () => ({
        error: 'Validation failed',
        fieldErrors: { body: 'must be string' },
      }),
    })

    let caught: unknown
    try {
      await updateNote('abc123', 'x')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(NoteValidationError)
    expect((caught as NoteValidationError).fieldErrors).toEqual({ body: 'must be string' })
  })

  it('throws a generic Error on other non-2xx', async () => {
    mockFetchOnce({ status: 500, ok: false, statusText: 'Internal Server Error' })
    await expect(updateNote('abc123', 'x')).rejects.toThrow(/500/)
  })

  it('forwards the AbortSignal', async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => sampleNote,
    })

    const controller = new AbortController()
    await updateNote('abc123', 'x', controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})

describe('deleteNote', () => {
  it('DELETEs <base>/<id> and resolves on 204', async () => {
    const fetchMock = mockFetchOnce({ status: 204, ok: true })

    await deleteNote('abc123')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(`${ENDPOINT}/abc123`)
    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.method).toBe('DELETE')
  })

  it('throws NoteNotFoundError on 404', async () => {
    mockFetchOnce({ status: 404, ok: false })
    await expect(deleteNote('missing')).rejects.toBeInstanceOf(NoteNotFoundError)
  })

  it('throws a generic Error on other non-2xx', async () => {
    mockFetchOnce({ status: 500, ok: false, statusText: 'Internal Server Error' })
    await expect(deleteNote('abc123')).rejects.toThrow(/500/)
  })

  it('forwards the AbortSignal', async () => {
    const fetchMock = mockFetchOnce({ status: 204, ok: true })

    const controller = new AbortController()
    await deleteNote('abc123', controller.signal)

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBe(controller.signal)
  })
})

describe('env var handling', () => {
  it('throws immediately when VITE_NOTES_ENDPOINT_BASE is unset', async () => {
    vi.stubEnv('VITE_NOTES_ENDPOINT_BASE', '')
    mockFetchOnce({
      status: 200,
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    })

    await expect(
      listNotesByComponent(SAMPLE_COMPONENT_URN, SAMPLE_F3D_ID)
    ).rejects.toThrow(/VITE_NOTES_ENDPOINT_BASE/)
    await expect(listNotesByAssembly(SAMPLE_ROOT_URN)).rejects.toThrow(/VITE_NOTES_ENDPOINT_BASE/)
    await expect(createNote(sampleInput)).rejects.toThrow(/VITE_NOTES_ENDPOINT_BASE/)
    await expect(updateNote('abc123', 'x')).rejects.toThrow(/VITE_NOTES_ENDPOINT_BASE/)
    await expect(deleteNote('abc123')).rejects.toThrow(/VITE_NOTES_ENDPOINT_BASE/)
  })
})
