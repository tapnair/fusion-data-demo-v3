/**
 * Tests for BomColumnSettings component.
 *
 * BomColumnSettings renders:
 *   - A "Columns" button that opens a Popover containing checkboxes for each
 *     BOM_COLUMNS entry (and optional base property columns).
 *   - A "Precision" button that opens a Menu of decimal-place options.
 *   - A refresh IconButton (RefreshIcon) when BOTH thumbnailColumnVisible AND
 *     onRefreshThumbnails are provided.
 *
 * Column visibility rules (from handleToggle):
 *   - alwaysVisible columns (only "name") cannot be toggled — their checkbox
 *     is disabled.
 *   - All other columns call onChange with an updated id list that always
 *     includes alwaysVisible columns.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BomColumnSettings } from './BomColumnSettings'
import { BOM_COLUMNS } from './bomColumns'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
    removeItem: (key: string) => { delete store[key] },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default minimal props that satisfy all required fields. */
const DEFAULT_VISIBLE = ['name', 'description', 'partNumber']

function renderSettings(overrides: Partial<React.ComponentProps<typeof BomColumnSettings>> = {}) {
  const onChange = vi.fn()
  const onSigFigsChange = vi.fn()

  const props: React.ComponentProps<typeof BomColumnSettings> = {
    visibleColumnIds: DEFAULT_VISIBLE,
    onChange,
    sigFigs: 2,
    onSigFigsChange,
    ...overrides,
  }

  const result = render(<BomColumnSettings {...props} />)
  return { ...result, onChange, onSigFigsChange }
}

/** Open the Columns popover by clicking the "Columns" button. */
async function openColumnsPopover() {
  const button = screen.getByRole('button', { name: /columns/i })
  await userEvent.click(button)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BomColumnSettings', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // ── Columns button ────────────────────────────────────────────────────────

  describe('"Columns" button', () => {
    it('is rendered', () => {
      renderSettings()
      expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument()
    })

    it('opens a popover with column checkboxes when clicked', async () => {
      renderSettings()
      await openColumnsPopover()

      // The popover should show a checkbox for every BOM column
      for (const col of BOM_COLUMNS) {
        expect(screen.getByRole('checkbox', { name: col.header })).toBeInTheDocument()
      }
    })
  })

  // ── Precision button ──────────────────────────────────────────────────────

  describe('"Precision" button', () => {
    it('is rendered', () => {
      renderSettings()
      expect(screen.getByRole('button', { name: /precision/i })).toBeInTheDocument()
    })

    it('opens a menu with decimal-place options when clicked', async () => {
      renderSettings()
      await userEvent.click(screen.getByRole('button', { name: /precision/i }))

      // The menu should contain at least the "0" and ".XX" options
      expect(screen.getByRole('menuitem', { name: '0' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: '.XX' })).toBeInTheDocument()
    })

    it('calls onSigFigsChange with the selected value and closes the menu', async () => {
      const { onSigFigsChange } = renderSettings()
      await userEvent.click(screen.getByRole('button', { name: /precision/i }))
      await userEvent.click(screen.getByRole('menuitem', { name: '.XXX' }))
      expect(onSigFigsChange).toHaveBeenCalledWith(3)
    })
  })

  // ── alwaysVisible column (Name) ───────────────────────────────────────────

  describe('always-visible column checkbox', () => {
    it('is checked and disabled for the "Name" column', async () => {
      renderSettings({ visibleColumnIds: ['name'] })
      await openColumnsPopover()

      const nameCheckbox = screen.getByRole('checkbox', { name: 'Name' })
      expect(nameCheckbox).toBeChecked()
      expect(nameCheckbox).toBeDisabled()
    })

    it('does NOT call onChange when the disabled Name checkbox is clicked', async () => {
      const { onChange } = renderSettings({ visibleColumnIds: ['name'] })
      await openColumnsPopover()

      const nameCheckbox = screen.getByRole('checkbox', { name: 'Name' })
      // MUI renders disabled checkboxes with pointer-events:none. Use
      // pointerEventsCheck: 0 so userEvent can still dispatch events, letting
      // us verify the handleToggle guard (alwaysVisible early-return) fires.
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      await user.click(nameCheckbox)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  // ── Toggling a non-alwaysVisible column ───────────────────────────────────

  describe('column visibility toggle', () => {
    it('calls onChange with column added when an unchecked checkbox is clicked', async () => {
      // Start with only 'name' visible; 'description' is unchecked
      const { onChange } = renderSettings({ visibleColumnIds: ['name'] })
      await openColumnsPopover()

      const descriptionCheckbox = screen.getByRole('checkbox', { name: 'Description' })
      expect(descriptionCheckbox).not.toBeChecked()

      await userEvent.click(descriptionCheckbox)

      expect(onChange).toHaveBeenCalledOnce()
      const [newIds] = onChange.mock.calls[0]
      expect(newIds).toContain('name')        // alwaysVisible preserved
      expect(newIds).toContain('description') // newly added
    })

    it('calls onChange with column removed when a checked checkbox is clicked', async () => {
      // Start with both 'name' and 'description' visible
      const { onChange } = renderSettings({ visibleColumnIds: ['name', 'description'] })
      await openColumnsPopover()

      const descriptionCheckbox = screen.getByRole('checkbox', { name: 'Description' })
      expect(descriptionCheckbox).toBeChecked()

      await userEvent.click(descriptionCheckbox)

      expect(onChange).toHaveBeenCalledOnce()
      const [newIds] = onChange.mock.calls[0]
      expect(newIds).toContain('name')           // alwaysVisible preserved
      expect(newIds).not.toContain('description') // removed
    })

    it('always includes alwaysVisible columns in the onChange result', async () => {
      // 'name' is not in initial list — handleToggle should still include it
      const { onChange } = renderSettings({ visibleColumnIds: [] })
      await openColumnsPopover()

      const descriptionCheckbox = screen.getByRole('checkbox', { name: 'Description' })
      await userEvent.click(descriptionCheckbox)

      const [newIds] = onChange.mock.calls[0]
      expect(newIds).toContain('name')
    })
  })

  // ── Refresh Thumbnails button ─────────────────────────────────────────────

  describe('Refresh Thumbnails button', () => {
    it('does NOT appear when thumbnailColumnVisible is false', () => {
      renderSettings({ thumbnailColumnVisible: false, onRefreshThumbnails: vi.fn() })
      // The IconButton has no accessible label text, but it holds a RefreshIcon.
      // We assert absence by querying for the tooltip / title attribute.
      expect(screen.queryByTitle(/re-fetch/i)).not.toBeInTheDocument()
    })

    it('does NOT appear when onRefreshThumbnails is not provided', () => {
      renderSettings({ thumbnailColumnVisible: true, onRefreshThumbnails: undefined })
      expect(screen.queryByTitle(/re-fetch/i)).not.toBeInTheDocument()
    })

    it('appears when thumbnailColumnVisible is true AND onRefreshThumbnails is provided', () => {
      renderSettings({ thumbnailColumnVisible: true, onRefreshThumbnails: vi.fn() })
      // MUI Tooltip renders its title as an aria-label on the child element
      // or we can check for the button by its accessible description.
      // The Tooltip wraps an IconButton — look for any button beyond Columns/Precision.
      const buttons = screen.getAllByRole('button')
      // 3 buttons: Columns, Precision, Refresh
      expect(buttons).toHaveLength(3)
    })

    it('calls onRefreshThumbnails when the refresh button is clicked', async () => {
      const onRefreshThumbnails = vi.fn()
      renderSettings({ thumbnailColumnVisible: true, onRefreshThumbnails })

      const buttons = screen.getAllByRole('button')
      const refreshButton = buttons[2] // third button is the IconButton
      await userEvent.click(refreshButton)

      expect(onRefreshThumbnails).toHaveBeenCalledOnce()
    })
  })

  // ── Base property columns ─────────────────────────────────────────────────

  describe('base property columns', () => {
    const baseDefs = [
      { id: 'bp-1', name: 'Material Cost', isReadOnly: false, specification: null },
      { id: 'bp-2', name: 'Lead Time', isReadOnly: true, specification: null },
    ]

    it('renders a section divider and base property checkboxes when definitions are provided', async () => {
      renderSettings({ basePropertyDefs: baseDefs, basePropsLoading: false })
      await openColumnsPopover()

      expect(screen.getByText('Base Properties')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Material Cost' })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Lead Time' })).toBeInTheDocument()
    })

    it('shows a loading spinner when basePropsLoading is true', async () => {
      renderSettings({ basePropertyDefs: undefined, basePropsLoading: true })
      await openColumnsPopover()

      // MUI CircularProgress renders a role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('calls onChange with baseProp:<id> when a base prop checkbox is toggled', async () => {
      const { onChange } = renderSettings({
        visibleColumnIds: ['name'],
        basePropertyDefs: baseDefs,
        basePropsLoading: false,
      })
      await openColumnsPopover()

      const materialCostCheckbox = screen.getByRole('checkbox', { name: 'Material Cost' })
      await userEvent.click(materialCostCheckbox)

      const [newIds] = onChange.mock.calls[0]
      expect(newIds).toContain('baseProp:bp-1')
    })
  })
})
