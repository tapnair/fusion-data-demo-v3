import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listNotesByComponent,
  listNotesByAssembly,
  createNote,
  updateNote,
  deleteNote,
  type CreateNoteInput,
  type Note,
} from '../services/notes/notesClient'

export type UseNotesArgs =
  | { mode: 'component'; componentLineageUrn: string; componentF3dId: string }
  | { mode: 'assembly'; rootLineageUrn: string }

export interface UseNotesResult {
  notes: Note[]
  loading: boolean
  error: string | null
  refetch: () => void
  create: (input: CreateNoteInput) => Promise<void>
  update: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useNotes(args: UseNotesArgs): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const mode = args.mode
  const identifier =
    args.mode === 'component'
      ? `${args.componentLineageUrn}::${args.componentF3dId}`
      : args.rootLineageUrn
  const componentLineageUrn = args.mode === 'component' ? args.componentLineageUrn : ''
  const componentF3dId = args.mode === 'component' ? args.componentF3dId : ''
  const rootLineageUrn = args.mode === 'assembly' ? args.rootLineageUrn : ''

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const result =
          mode === 'component'
            ? await listNotesByComponent(componentLineageUrn, componentF3dId, controller.signal)
            : await listNotesByAssembly(rootLineageUrn, controller.signal)
        if (controller.signal.aborted) return
        setNotes(result)
        setLoading(false)
      } catch (err) {
        if (controller.signal.aborted) return
        const msg = err instanceof Error ? err.message : 'Notes lookup failed'
        setError(msg)
        setNotes([])
        setLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
    // identifier captures both composite parts (component mode) or rootLineageUrn (assembly mode);
    // the dedicated values are read inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, identifier, refetchKey])

  const refetch = useCallback(() => {
    setRefetchKey((k) => k + 1)
  }, [])

  const create = useCallback(async (input: CreateNoteInput) => {
    try {
      await createNote(input)
      setRefetchKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create note'
      setError(msg)
      throw err
    }
  }, [])

  const update = useCallback(async (id: string, body: string) => {
    try {
      await updateNote(id, body)
      setRefetchKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update note'
      setError(msg)
      throw err
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteNote(id)
      setRefetchKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete note'
      setError(msg)
      throw err
    }
  }, [])

  return { notes, loading, error, refetch, create, update, remove }
}
