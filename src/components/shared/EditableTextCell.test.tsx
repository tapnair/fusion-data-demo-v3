import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableTextCell } from './EditableTextCell'

function renderCell(overrides: Partial<React.ComponentProps<typeof EditableTextCell>> = {}) {
  const onCommit = overrides.onCommit ?? vi.fn().mockResolvedValue(undefined)
  const props: React.ComponentProps<typeof EditableTextCell> = {
    value: 'hello',
    onCommit,
    ...overrides,
  }
  const result = render(<EditableTextCell {...props} />)
  return { ...result, onCommit }
}

describe('EditableTextCell', () => {
  describe('display mode', () => {
    it('renders the value as plain Typography', () => {
      renderCell({ value: 'widget' })
      expect(screen.getByText('widget')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('entering edit mode', () => {
    it('shows an input and autofocuses it when clicked', async () => {
      renderCell({ value: 'widget' })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input).toHaveFocus()
      expect(input.value).toBe('widget')
    })
  })

  describe('committing', () => {
    it('calls onCommit with the trimmed value when Enter is pressed', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      renderCell({ value: 'widget', onCommit })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.type(input, '  new value  {Enter}')
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('new value'))
    })

    it('commits on blur', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      render(
        <>
          <EditableTextCell value="widget" onCommit={onCommit} />
          <button>outside</button>
        </>
      )
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.type(input, 'blurred')
      await userEvent.click(screen.getByRole('button', { name: 'outside' }))
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('blurred'))
    })
  })

  describe('canceling', () => {
    it('Escape exits edit mode without calling onCommit', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      renderCell({ value: 'widget', onCommit })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.type(input, ' edited')
      await userEvent.keyboard('{Escape}')
      expect(onCommit).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText('widget')).toBeInTheDocument()
    })

    it('clearing the field and committing acts as cancel', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      renderCell({ value: 'widget', onCommit })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.keyboard('{Enter}')
      expect(onCommit).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    })
  })

  describe('error handling', () => {
    it('reverts on commit rejection and shows helperText on next edit', async () => {
      const onCommit = vi.fn().mockRejectedValue(new Error('boom'))
      renderCell({ value: 'widget', onCommit })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.type(input, 'changed{Enter}')

      // Wait for save to fail and value to revert
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('changed'))
      await waitFor(() => expect(screen.getByText('widget')).toBeInTheDocument())

      // Re-enter edit mode — helperText should display the error
      await userEvent.click(screen.getByText('widget'))
      expect(await screen.findByText('boom')).toBeInTheDocument()
    })
  })

  describe('readOnly', () => {
    it('does not enter edit mode on click', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      render(<EditableTextCell value="locked" readOnly onCommit={onCommit} />)
      await userEvent.click(screen.getByText('locked'))
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(onCommit).not.toHaveBeenCalled()
    })
  })

  describe('validate', () => {
    it('blocks commit, shows helperText, and stays in edit mode when validate returns a string', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined)
      const validate = (next: string) => (next === 'bad' ? 'not allowed' : null)
      renderCell({ value: 'widget', onCommit, validate })
      await userEvent.click(screen.getByText('widget'))
      const input = screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.type(input, 'bad{Enter}')

      expect(onCommit).not.toHaveBeenCalled()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByText('not allowed')).toBeInTheDocument()
    })
  })
})
