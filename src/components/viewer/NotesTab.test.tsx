import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotesTab } from './NotesTab'
import { MockAuthProvider } from '../../test/mockAuthContext'
import type { UseNotesArgs, UseNotesResult } from '../../hooks/useNotes'
import type { Note } from '../../services/notes/notesClient'
import type { ViewerSelection } from '../../types/viewerSelection.types'

const mockUseNotes = vi.fn<(args: UseNotesArgs) => UseNotesResult>()

vi.mock('../../hooks/useNotes', () => ({
  useNotes: (args: UseNotesArgs) => mockUseNotes(args),
}))

const ROOT_LINEAGE_URN = 'urn:adsk.wipprod:dm.lineage:root-lineage-1'
const ROOT_F3D_ID = '00000000-0000-0000-0000-000000000001'
const COMPONENT_LINEAGE_URN = 'urn:adsk.wipprod:dm.lineage:component-lineage-1'
const COMPONENT_F3D_ID = '50d3754d-9629-49e5-b6c1-e05d365e61f6'

const ROOT_SELECTION: ViewerSelection = {
  componentDbId: 1,
  componentName: 'Espresso Machine v1',
  componentProperties: [],
  modelId: 'root-model-id',
  componentLineageUrn: ROOT_LINEAGE_URN,
  componentF3dId: ROOT_F3D_ID,
  body: null,
  hierarchyPath: [{ dbId: 1, name: 'Espresso Machine v1' }],
}

const COMPONENT_SELECTION: ViewerSelection = {
  componentDbId: 2,
  componentName: 'Controls Bottom Piece',
  componentProperties: [],
  modelId: 'component-model-id',
  componentLineageUrn: COMPONENT_LINEAGE_URN,
  componentF3dId: COMPONENT_F3D_ID,
  body: null,
  hierarchyPath: [
    { dbId: 1, name: 'Espresso Machine v1' },
    { dbId: 2, name: 'Controls Bottom Piece' },
  ],
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    componentLineageUrn: COMPONENT_LINEAGE_URN,
    componentF3dId: COMPONENT_F3D_ID,
    rootLineageUrn: ROOT_LINEAGE_URN,
    componentName: 'Controls Bottom Piece',
    body: 'sample body',
    author: 'Alice',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function baseResult(overrides: Partial<UseNotesResult> = {}): UseNotesResult {
  return {
    notes: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    create: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...overrides,
  }
}

function renderTab(
  effective: ViewerSelection,
  rootSelection: ViewerSelection,
  authOverrides?: { user?: { id: string; name: string } | null }
) {
  return render(
    <MockAuthProvider overrides={authOverrides as any}>
      <NotesTab effective={effective} rootSelection={rootSelection} />
    </MockAuthProvider>
  )
}

describe('NotesTab', () => {
  beforeEach(() => {
    mockUseNotes.mockReset()
  })

  describe('component scope', () => {
    it('shows "On: <componentName>" header and queries by component', () => {
      mockUseNotes.mockReturnValue(baseResult())
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      expect(screen.getByText('On')).toBeInTheDocument()
      expect(screen.getByText('Controls Bottom Piece')).toBeInTheDocument()
      expect(mockUseNotes).toHaveBeenCalledWith({
        mode: 'component',
        componentLineageUrn: COMPONENT_LINEAGE_URN,
        componentF3dId: COMPONENT_F3D_ID,
      })
    })
  })

  describe('assembly scope', () => {
    it('shows "All notes in <rootName>" header and queries by assembly', () => {
      mockUseNotes.mockReturnValue(baseResult())
      renderTab(ROOT_SELECTION, ROOT_SELECTION)
      expect(screen.getByText('All notes in')).toBeInTheDocument()
      expect(screen.getByText('Espresso Machine v1')).toBeInTheDocument()
      expect(mockUseNotes).toHaveBeenCalledWith({
        mode: 'assembly',
        rootLineageUrn: ROOT_LINEAGE_URN,
      })
    })
  })

  describe('empty state', () => {
    it('shows the "No notes yet" message when notes is empty', () => {
      mockUseNotes.mockReturnValue(baseResult())
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
    })
  })

  describe('invalid scope', () => {
    it('shows the "Open an assembly" message when componentLineageUrn is null (component scope)', () => {
      mockUseNotes.mockReturnValue(baseResult())
      const noLineage: ViewerSelection = {
        ...COMPONENT_SELECTION,
        componentLineageUrn: null,
      }
      renderTab(noLineage, ROOT_SELECTION)
      expect(screen.getByText(/open an assembly to see notes/i)).toBeInTheDocument()
    })

    it('shows the "Open an assembly" message when componentF3dId is null (component scope)', () => {
      mockUseNotes.mockReturnValue(baseResult())
      const noF3d: ViewerSelection = {
        ...COMPONENT_SELECTION,
        componentF3dId: null,
      }
      renderTab(noF3d, ROOT_SELECTION)
      expect(screen.getByText(/open an assembly to see notes/i)).toBeInTheDocument()
    })

    it('shows the "Open an assembly" message when rootLineageUrn is null (assembly scope)', () => {
      mockUseNotes.mockReturnValue(baseResult())
      const noRootLineage: ViewerSelection = {
        ...ROOT_SELECTION,
        componentLineageUrn: null,
      }
      renderTab(noRootLineage, noRootLineage)
      expect(screen.getByText(/open an assembly to see notes/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows a progressbar', () => {
      mockUseNotes.mockReturnValue(baseResult({ loading: true }))
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows an error alert with the error message', () => {
      mockUseNotes.mockReturnValue(baseResult({ error: 'boom' }))
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      const alert = screen.getByRole('alert')
      expect(within(alert).getByText('boom')).toBeInTheDocument()
    })
  })

  describe('add form', () => {
    it('disables the Add note button when body is whitespace', async () => {
      const user = userEvent.setup()
      mockUseNotes.mockReturnValue(baseResult())
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      const addBtn = screen.getByRole('button', { name: /add note/i })
      expect(addBtn).toBeDisabled()
      const textarea = screen.getByPlaceholderText(/add a note/i)
      await user.type(textarea, '   ')
      expect(addBtn).toBeDisabled()
      await user.type(textarea, 'hello')
      expect(addBtn).not.toBeDisabled()
    })

    it('calls create with the right shape and clears the field on success', async () => {
      const user = userEvent.setup()
      const create = vi.fn(async () => {})
      mockUseNotes.mockReturnValue(baseResult({ create }))
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION, {
        user: { id: 'u1', name: 'Patrick' },
      })
      const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement
      await user.type(textarea, 'A new note')
      const addBtn = screen.getByRole('button', { name: /add note/i })
      await user.click(addBtn)
      await waitFor(() => {
        expect(create).toHaveBeenCalledWith({
          componentLineageUrn: COMPONENT_LINEAGE_URN,
          componentF3dId: COMPONENT_F3D_ID,
          rootLineageUrn: ROOT_LINEAGE_URN,
          componentName: 'Controls Bottom Piece',
          body: 'A new note',
          author: 'Patrick',
        })
      })
      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
    })

    it('falls back to author "Unknown" when user has no name', async () => {
      const user = userEvent.setup()
      const create = vi.fn(async () => {})
      mockUseNotes.mockReturnValue(baseResult({ create }))
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION, { user: null })
      await user.type(screen.getByPlaceholderText(/add a note/i), 'hi')
      await user.click(screen.getByRole('button', { name: /add note/i }))
      await waitFor(() => {
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({ author: 'Unknown' })
        )
      })
    })
  })

  describe('edit', () => {
    it('clicking the edit icon enters edit mode; Save calls update; Cancel exits without calling', async () => {
      const user = userEvent.setup()
      const update = vi.fn(async () => {})
      mockUseNotes.mockReturnValue(
        baseResult({
          notes: [makeNote({ id: 'n1', body: 'original' })],
          update,
        })
      )
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)

      const editBtns = screen.getAllByLabelText(/edit note/i)
      await user.click(editBtns[0])
      const editArea = await screen.findByDisplayValue('original')
      await user.clear(editArea)
      await user.type(editArea, 'edited body')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(update).toHaveBeenCalledWith('n1', 'edited body')
      })

      // Re-enter edit and cancel
      mockUseNotes.mockReturnValue(
        baseResult({
          notes: [makeNote({ id: 'n1', body: 'original' })],
          update,
        })
      )
      const updateCallsBefore = update.mock.calls.length
      const editBtns2 = screen.getAllByLabelText(/edit note/i)
      await user.click(editBtns2[0])
      const cancelBtn = await screen.findByRole('button', { name: /cancel/i })
      await user.click(cancelBtn)
      expect(update.mock.calls.length).toBe(updateCallsBefore)
    })
  })

  describe('delete', () => {
    it('clicking the trash icon opens a confirm dialog; Cancel closes without calling remove', async () => {
      const user = userEvent.setup()
      const remove = vi.fn(async () => {})
      mockUseNotes.mockReturnValue(
        baseResult({ notes: [makeNote({ id: 'n1' })], remove })
      )
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      await user.click(screen.getAllByLabelText(/delete note/i)[0])
      expect(await screen.findByText(/delete this note\?/i)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByText(/delete this note\?/i)).not.toBeInTheDocument()
      })
      expect(remove).not.toHaveBeenCalled()
    })

    it('Confirm calls remove(id)', async () => {
      const user = userEvent.setup()
      const remove = vi.fn(async () => {})
      mockUseNotes.mockReturnValue(
        baseResult({ notes: [makeNote({ id: 'n42' })], remove })
      )
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      await user.click(screen.getAllByLabelText(/delete note/i)[0])
      const deleteBtns = await screen.findAllByRole('button', { name: /delete/i })
      // last button is the confirm "Delete" inside the dialog
      await user.click(deleteBtns[deleteBtns.length - 1])
      await waitFor(() => {
        expect(remove).toHaveBeenCalledWith('n42')
      })
    })
  })

  describe('note metadata rendering', () => {
    it('renders author, time, and body for multiple notes', () => {
      const now = Date.now()
      mockUseNotes.mockReturnValue(
        baseResult({
          notes: [
            makeNote({
              id: 'a',
              author: 'Alice',
              body: 'first',
              createdAt: new Date(now - 30 * 1000).toISOString(),
            }),
            makeNote({
              id: 'b',
              author: 'Bob',
              body: 'second',
              createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
            }),
          ],
        })
      )
      renderTab(COMPONENT_SELECTION, ROOT_SELECTION)
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('first')).toBeInTheDocument()
      expect(screen.getByText('second')).toBeInTheDocument()
      expect(screen.getByText('just now')).toBeInTheDocument()
      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })
  })
})

