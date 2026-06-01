import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Note, CreateNoteInput } from '../services/notes/notesClient'

vi.mock('../services/notes/notesClient', async () => {
  const actual = await vi.importActual<typeof import('../services/notes/notesClient')>(
    '../services/notes/notesClient'
  )
  return {
    ...actual,
    listNotesByComponent: vi.fn(),
    listNotesByAssembly: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  }
})

import {
  listNotesByComponent,
  listNotesByAssembly,
  createNote,
  updateNote,
  deleteNote,
} from '../services/notes/notesClient'
import { useNotes, type UseNotesArgs } from './useNotes'

const mockListByComponent = listNotesByComponent as ReturnType<typeof vi.fn>
const mockListByAssembly = listNotesByAssembly as ReturnType<typeof vi.fn>
const mockCreate = createNote as ReturnType<typeof vi.fn>
const mockUpdate = updateNote as ReturnType<typeof vi.fn>
const mockDelete = deleteNote as ReturnType<typeof vi.fn>

const COMPONENT_URN_A = 'urn:adsk.wipprod:dm.lineage:cmp-a'
const COMPONENT_URN_B = 'urn:adsk.wipprod:dm.lineage:cmp-b'
const F3D_ID_A = '50d3754d-9629-49e5-b6c1-e05d365e61f6'
const F3D_ID_B = '11111111-2222-3333-4444-555555555555'
const ROOT_URN_A = 'urn:adsk.wipprod:dm.lineage:root-a'
const ROOT_URN_B = 'urn:adsk.wipprod:dm.lineage:root-b'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    componentLineageUrn: COMPONENT_URN_A,
    componentF3dId: F3D_ID_A,
    rootLineageUrn: ROOT_URN_A,
    componentName: 'Widget',
    body: 'hello',
    author: 'Patrick',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

const createInput: CreateNoteInput = {
  componentLineageUrn: COMPONENT_URN_A,
  componentF3dId: F3D_ID_A,
  rootLineageUrn: ROOT_URN_A,
  componentName: 'Widget',
  body: 'new body',
  author: 'Patrick',
}

beforeEach(() => {
  mockListByComponent.mockReset()
  mockListByAssembly.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
})

describe('useNotes', () => {
  test('component mode: lists by composite key; transitions loading → done', async () => {
    const notes = [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })]
    mockListByComponent.mockResolvedValue(notes)

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.notes).toEqual([])

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes).toEqual(notes)
    expect(result.current.error).toBeNull()
    expect(mockListByComponent).toHaveBeenCalledTimes(1)
    expect(mockListByComponent.mock.calls[0][0]).toBe(COMPONENT_URN_A)
    expect(mockListByComponent.mock.calls[0][1]).toBe(F3D_ID_A)
    expect(mockListByAssembly).not.toHaveBeenCalled()
  })

  test('assembly mode: lists by rootLineageUrn', async () => {
    const notes = [makeNote({ id: 'na' })]
    mockListByAssembly.mockResolvedValue(notes)

    const { result } = renderHook(() =>
      useNotes({ mode: 'assembly', rootLineageUrn: ROOT_URN_A })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes).toEqual(notes)
    expect(mockListByAssembly).toHaveBeenCalledTimes(1)
    expect(mockListByAssembly.mock.calls[0][0]).toBe(ROOT_URN_A)
    expect(mockListByComponent).not.toHaveBeenCalled()
  })

  test('switching mode triggers a fresh fetch with the new identifier', async () => {
    mockListByComponent.mockResolvedValue([makeNote({ id: 'c1' })])
    mockListByAssembly.mockResolvedValue([makeNote({ id: 'a1' })])

    const { result, rerender } = renderHook(
      (args: UseNotesArgs) => useNotes(args),
      {
        initialProps: {
          mode: 'component',
          componentLineageUrn: COMPONENT_URN_A,
          componentF3dId: F3D_ID_A,
        } as UseNotesArgs,
      }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes[0].id).toBe('c1')

    rerender({ mode: 'assembly', rootLineageUrn: ROOT_URN_A } as UseNotesArgs)

    await waitFor(() => expect(result.current.notes[0]?.id).toBe('a1'))
    expect(mockListByComponent).toHaveBeenCalledTimes(1)
    expect(mockListByAssembly).toHaveBeenCalledTimes(1)
  })

  test('switching componentLineageUrn triggers a fresh fetch', async () => {
    mockListByComponent.mockImplementation(async (urn: string, _f3d: string) => [
      makeNote({ id: `n-${urn}` }),
    ])

    const { result, rerender } = renderHook(
      ({ urn, f3d }: { urn: string; f3d: string }) =>
        useNotes({
          mode: 'component',
          componentLineageUrn: urn,
          componentF3dId: f3d,
        }),
      { initialProps: { urn: COMPONENT_URN_A, f3d: F3D_ID_A } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes[0].id).toBe(`n-${COMPONENT_URN_A}`)

    rerender({ urn: COMPONENT_URN_B, f3d: F3D_ID_A })

    await waitFor(() => expect(result.current.notes[0]?.id).toBe(`n-${COMPONENT_URN_B}`))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('switching componentF3dId triggers a fresh fetch', async () => {
    mockListByComponent.mockImplementation(async (_urn: string, f3d: string) => [
      makeNote({ id: `n-${f3d}` }),
    ])

    const { result, rerender } = renderHook(
      ({ urn, f3d }: { urn: string; f3d: string }) =>
        useNotes({
          mode: 'component',
          componentLineageUrn: urn,
          componentF3dId: f3d,
        }),
      { initialProps: { urn: COMPONENT_URN_A, f3d: F3D_ID_A } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes[0].id).toBe(`n-${F3D_ID_A}`)

    rerender({ urn: COMPONENT_URN_A, f3d: F3D_ID_B })

    await waitFor(() => expect(result.current.notes[0]?.id).toBe(`n-${F3D_ID_B}`))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('switching rootLineageUrn triggers a fresh fetch (assembly mode)', async () => {
    mockListByAssembly.mockImplementation(async (urn: string) => [
      makeNote({ id: `r-${urn}` }),
    ])

    const { result, rerender } = renderHook(
      ({ urn }: { urn: string }) =>
        useNotes({ mode: 'assembly', rootLineageUrn: urn }),
      { initialProps: { urn: ROOT_URN_A } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes[0].id).toBe(`r-${ROOT_URN_A}`)

    rerender({ urn: ROOT_URN_B })

    await waitFor(() => expect(result.current.notes[0]?.id).toBe(`r-${ROOT_URN_B}`))
    expect(mockListByAssembly).toHaveBeenCalledTimes(2)
  })

  test('create calls createNote with composite payload and refetches', async () => {
    const initial = [makeNote({ id: 'n1' })]
    const after = [makeNote({ id: 'n1' }), makeNote({ id: 'n2', body: 'new body' })]
    mockListByComponent.mockResolvedValueOnce(initial).mockResolvedValueOnce(after)
    mockCreate.mockResolvedValue(makeNote({ id: 'n2', body: 'new body' }))

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes).toEqual(initial)

    await act(async () => {
      await result.current.create(createInput)
    })

    expect(mockCreate).toHaveBeenCalledWith(createInput)
    await waitFor(() => expect(result.current.notes).toEqual(after))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('update calls updateNote and refetches', async () => {
    const initial = [makeNote({ id: 'n1', body: 'hello' })]
    const after = [makeNote({ id: 'n1', body: 'updated' })]
    mockListByComponent.mockResolvedValueOnce(initial).mockResolvedValueOnce(after)
    mockUpdate.mockResolvedValue(makeNote({ id: 'n1', body: 'updated' }))

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.update('n1', 'updated')
    })

    expect(mockUpdate).toHaveBeenCalledWith('n1', 'updated')
    await waitFor(() => expect(result.current.notes).toEqual(after))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('remove calls deleteNote and refetches', async () => {
    const initial = [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })]
    const after = [makeNote({ id: 'n2' })]
    mockListByComponent.mockResolvedValueOnce(initial).mockResolvedValueOnce(after)
    mockDelete.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.remove('n1')
    })

    expect(mockDelete).toHaveBeenCalledWith('n1')
    await waitFor(() => expect(result.current.notes).toEqual(after))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('refetch() re-runs the list fetch', async () => {
    mockListByComponent
      .mockResolvedValueOnce([makeNote({ id: 'n1' })])
      .mockResolvedValueOnce([makeNote({ id: 'n2' })])

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes[0].id).toBe('n1')

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.notes[0]?.id).toBe('n2'))
    expect(mockListByComponent).toHaveBeenCalledTimes(2)
  })

  test('list error sets error and empty notes', async () => {
    mockListByComponent.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
    expect(result.current.notes).toEqual([])
  })

  test('mutation error: surfaces error and rethrows', async () => {
    mockListByComponent.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('create-fail'))

    const { result } = renderHook(() =>
      useNotes({
        mode: 'component',
        componentLineageUrn: COMPONENT_URN_A,
        componentF3dId: F3D_ID_A,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.create(createInput)).rejects.toThrow('create-fail')
    })

    await waitFor(() => expect(result.current.error).toBe('create-fail'))
  })
})
