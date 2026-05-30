import { render, screen, within } from '@testing-library/react'
import { ErpTab } from './ErpTab'
import type { ErpMaterial } from '../../services/erp/erpClient'
import type { UseErpDataResult } from '../../hooks/useErpData'

const mockUseErpData = vi.fn<(modelId: string | null) => UseErpDataResult>()

vi.mock('../../hooks/useErpData', () => ({
  useErpData: (modelId: string | null) => mockUseErpData(modelId),
}))

const SAMPLE_MATERIAL: ErpMaterial = {
  modelId: 'm1',
  matnr: '7601025',
  maktx: 'CONTROLS BOTTOM PIECE',
  meins: 'EA',
  mtart: 'FERT',
  werks: 'PL01',
  mmsta: 'ACTIVE',
  beskz: 'F',
  dismm: 'PD',
  plifz: 14,
  eisbe: 25,
  stprs: 12.34,
  waers: 'USD',
  bestand: 142,
  vendor: { lifnr: 'V100023', name: 'Acme Components Inc.' },
  lastUpdated: '2026-05-29T15:30:00.000Z',
}

describe('ErpTab', () => {
  beforeEach(() => {
    mockUseErpData.mockReset()
  })

  describe('modelId === null', () => {
    it('renders "No component selected" caption and calls the hook with null', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: null })
      render(<ErpTab modelId={null} />)
      expect(screen.getByText(/no component selected/i)).toBeInTheDocument()
      expect(mockUseErpData).toHaveBeenCalledWith(null)
    })
  })

  describe('loading state', () => {
    it('renders a CircularProgress', () => {
      mockUseErpData.mockReturnValue({ loading: true, error: null, material: null })
      render(<ErpTab modelId="m1" />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('renders an error alert with the error text', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: 'boom', material: null })
      render(<ErpTab modelId="m1" />)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(within(alert).getByText('boom')).toBeInTheDocument()
    })
  })

  describe('empty material (404)', () => {
    it('renders an info alert when material is null but modelId is set', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: null })
      render(<ErpTab modelId="m1" />)
      expect(
        screen.getByText(/no erp record exists for this component\./i)
      ).toBeInTheDocument()
    })
  })

  describe('populated material', () => {
    it('renders the matnr value', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: SAMPLE_MATERIAL })
      render(<ErpTab modelId="m1" />)
      expect(screen.getByText('7601025')).toBeInTheDocument()
    })

    it('renders the maktx value', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: SAMPLE_MATERIAL })
      render(<ErpTab modelId="m1" />)
      expect(screen.getByText('CONTROLS BOTTOM PIECE')).toBeInTheDocument()
    })

    describe('MTART friendly labels', () => {
      it('renders "FERT — Finished Goods" for mtart "FERT"', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, mtart: 'FERT' },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('FERT — Finished Goods')).toBeInTheDocument()
      })

      it('renders "HALB — Semi-Finished" for mtart "HALB"', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, mtart: 'HALB' },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('HALB — Semi-Finished')).toBeInTheDocument()
      })

      it('renders "ROH — Raw Material" for mtart "ROH"', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, mtart: 'ROH' },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('ROH — Raw Material')).toBeInTheDocument()
      })
    })

    describe('BESKZ friendly labels', () => {
      it('renders "E — In-house production" for beskz "E"', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, beskz: 'E', vendor: null },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('E — In-house production')).toBeInTheDocument()
      })

      it('renders "F — External procurement" for beskz "F"', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, beskz: 'F' },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('F — External procurement')).toBeInTheDocument()
      })
    })

    describe('vendor rows', () => {
      it('renders vendor name and LIFNR when beskz is "F" and vendor is set', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: SAMPLE_MATERIAL,
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.getByText('Acme Components Inc.')).toBeInTheDocument()
        expect(screen.getByText('V100023')).toBeInTheDocument()
        expect(screen.getByText('Vendor No.')).toBeInTheDocument()
      })

      it('omits the Vendor No. row when beskz is "E" and vendor is null', () => {
        mockUseErpData.mockReturnValue({
          loading: false,
          error: null,
          material: { ...SAMPLE_MATERIAL, beskz: 'E', vendor: null },
        })
        render(<ErpTab modelId="m1" />)
        expect(screen.queryByText('Vendor No.')).not.toBeInTheDocument()
        expect(screen.queryByText('Vendor')).not.toBeInTheDocument()
      })
    })

    it('renders stock on hand as "142 EA"', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: SAMPLE_MATERIAL })
      render(<ErpTab modelId="m1" />)
      expect(screen.getByText('142 EA')).toBeInTheDocument()
    })

    it('renders standard price as a USD currency value', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: SAMPLE_MATERIAL })
      render(<ErpTab modelId="m1" />)
      const priceLabel = screen.getByText('Standard Price')
      const row = priceLabel.parentElement as HTMLElement
      const valueText = row.textContent ?? ''
      expect(valueText).toContain('$')
      expect(valueText).toContain('12.34')
    })

    it('renders a Last Updated value', () => {
      mockUseErpData.mockReturnValue({ loading: false, error: null, material: SAMPLE_MATERIAL })
      render(<ErpTab modelId="m1" />)
      const label = screen.getByText('Last Updated')
      const row = label.parentElement as HTMLElement
      const valueText = (row.textContent ?? '').replace('Last Updated', '').trim()
      expect(valueText.length).toBeGreaterThan(0)
    })
  })
})
