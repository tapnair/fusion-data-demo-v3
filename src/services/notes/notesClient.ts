export interface Note {
  id: string
  componentLineageUrn: string
  componentF3dId: string
  rootLineageUrn: string
  componentName: string
  body: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface CreateNoteInput {
  componentLineageUrn: string
  componentF3dId: string
  rootLineageUrn: string
  componentName: string
  body: string
  author: string
}

interface NotesListResponse {
  results: Note[]
  total: number
}

export class NoteValidationError extends Error {
  fieldErrors?: Record<string, string>
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'NoteValidationError'
    this.fieldErrors = fieldErrors
  }
}

export class NoteNotFoundError extends Error {
  constructor(message = 'Note not found') {
    super(message)
    this.name = 'NoteNotFoundError'
  }
}

function getBase(): string {
  const base = import.meta.env.VITE_NOTES_ENDPOINT_BASE
  if (!base) {
    throw new Error('VITE_NOTES_ENDPOINT_BASE not configured')
  }
  return base
}

async function parseValidationError(resp: Response): Promise<NoteValidationError> {
  let fieldErrors: Record<string, string> | undefined
  let message = `Notes request failed: ${resp.status} ${resp.statusText}`
  try {
    const data = (await resp.json()) as { error?: string; fieldErrors?: Record<string, string> }
    if (data && typeof data === 'object') {
      if (data.error) message = data.error
      if (data.fieldErrors && typeof data.fieldErrors === 'object') {
        fieldErrors = data.fieldErrors
      }
    }
  } catch {
    // ignore JSON parse errors; use default message
  }
  return new NoteValidationError(message, fieldErrors)
}

async function listNotes(
  query: string,
  signal?: AbortSignal
): Promise<Note[]> {
  const base = getBase()
  const url = `${base}?${query}`
  const resp = await fetch(url, { signal })
  if (resp.status === 404) return []
  if (resp.status === 400) throw await parseValidationError(resp)
  if (!resp.ok) {
    throw new Error(`Notes request failed: ${resp.status} ${resp.statusText}`)
  }
  const data = (await resp.json()) as NotesListResponse
  return data.results
}

export async function listNotesByComponent(
  componentLineageUrn: string,
  componentF3dId: string,
  signal?: AbortSignal
): Promise<Note[]> {
  return listNotes(
    `componentLineageUrn=${encodeURIComponent(componentLineageUrn)}&componentF3dId=${encodeURIComponent(componentF3dId)}`,
    signal
  )
}

export async function listNotesByAssembly(
  rootLineageUrn: string,
  signal?: AbortSignal
): Promise<Note[]> {
  return listNotes(
    `rootLineageUrn=${encodeURIComponent(rootLineageUrn)}`,
    signal
  )
}

export async function createNote(
  input: CreateNoteInput,
  signal?: AbortSignal
): Promise<Note> {
  const base = getBase()
  const resp = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  if (resp.status === 400) throw await parseValidationError(resp)
  if (!resp.ok) {
    throw new Error(`Notes request failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as Note
}

export async function updateNote(
  id: string,
  body: string,
  signal?: AbortSignal
): Promise<Note> {
  const base = getBase()
  const resp = await fetch(`${base}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
    signal,
  })
  if (resp.status === 404) throw new NoteNotFoundError()
  if (resp.status === 400) throw await parseValidationError(resp)
  if (!resp.ok) {
    throw new Error(`Notes request failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as Note
}

export async function deleteNote(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  const base = getBase()
  const resp = await fetch(`${base}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })
  if (resp.status === 404) throw new NoteNotFoundError()
  if (!resp.ok && resp.status !== 204) {
    throw new Error(`Notes request failed: ${resp.status} ${resp.statusText}`)
  }
}
