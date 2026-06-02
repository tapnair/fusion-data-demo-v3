import React from 'react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MockAuthProvider } from '../test/mockAuthContext'
import type { ErpMaterial } from '../services/erp/erpClient'

vi.mock('../services/erp/erpClient', async () => {
  const actual = await vi.importActual<typeof import('../services/erp/erpClient')>(
    '../services/erp/erpClient'
  )
  return {
    ...actual,
    fetchErpMaterial: vi.fn(),
  }
})

import { fetchErpMaterial } from '../services/erp/erpClient'
import { useErpData, clearErpCache } from './useErpData'

const mockFetchErpMaterial = fetchErpMaterial as ReturnType<typeof vi.fn>

function makeMaterial(overrides: Partial<ErpMaterial> = {}): ErpMaterial {
  return {
    modelId: 'm-1',
    matnr: 'MAT-001',
    maktx: 'Sample Material',
    meins: 'EA',
    mtart: 'FERT',
    werks: 'PLT1',
    mmsta: 'ACTIVE',
    beskz: 'E',
    dismm: 'PD',
    plifz: 5,
    eisbe: 10,
    stprs: 1.23,
    waers: 'USD',
    bestand: 100,
    vendor: null,
    lastUpdated: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MockAuthProvider>{children}</MockAuthProvider>
)

beforeEach(() => {
  clearErpCache()
  mockFetchErpMaterial.mockReset()
})

describe('useErpData', () => {
  test('returns idle state and does not fetch when modelId is null', async () => {
    const { result } = renderHook(() => useErpData(null), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.material).toBeNull()

    await new Promise((r) => setTimeout(r, 10))
    expect(mockFetchErpMaterial).not.toHaveBeenCalled()
  })

  test('fetches and returns material on success', async () => {
    const material = makeMaterial({ modelId: 'm-1' })
    mockFetchErpMaterial.mockResolvedValue(material)

    const { result } = renderHook(() => useErpData('m-1'), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.material).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.material).toEqual(material)
    expect(result.current.error).toBeNull()
    expect(mockFetchErpMaterial).toHaveBeenCalledTimes(1)
  })

  test('treats null resolution (404) as no error and no material', async () => {
    mockFetchErpMaterial.mockResolvedValue(null)

    const { result } = renderHook(() => useErpData('m-404'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.material).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('sets error message when fetch throws', async () => {
    mockFetchErpMaterial.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useErpData('m-err'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
    expect(result.current.material).toBeNull()
  })

  test('always refetches — never serves from a hook-level cache (by design)', async () => {
    const material = makeMaterial({ modelId: 'x' })
    mockFetchErpMaterial.mockResolvedValue(material)

    const first = renderHook(() => useErpData('x'), { wrapper })
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.material).toEqual(material)
    expect(mockFetchErpMaterial).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useErpData('x'), { wrapper })
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.material).toEqual(material)
    expect(mockFetchErpMaterial).toHaveBeenCalledTimes(2)
  })

  test('refetches when modelId changes', async () => {
    const matX = makeMaterial({ modelId: 'x', matnr: 'X' })
    const matY = makeMaterial({ modelId: 'y', matnr: 'Y' })
    mockFetchErpMaterial.mockImplementation(async (id: string) => {
      if (id === 'x') return matX
      if (id === 'y') return matY
      return null
    })

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useErpData(id),
      { wrapper, initialProps: { id: 'x' } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.material).toEqual(matX)

    rerender({ id: 'y' })

    await waitFor(() => expect(result.current.material).toEqual(matY))
    expect(result.current.loading).toBe(false)
    expect(mockFetchErpMaterial).toHaveBeenCalledTimes(2)
  })

  test('aborts the in-flight fetch when the hook unmounts', async () => {
    let capturedSignal: AbortSignal | undefined
    let resolveFetch: (value: ErpMaterial | null) => void = () => {}
    mockFetchErpMaterial.mockImplementation(
      (_modelId: string, _token: string, signal?: AbortSignal) => {
        capturedSignal = signal
        return new Promise<ErpMaterial | null>((resolve) => {
          resolveFetch = resolve
        })
      }
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result, unmount } = renderHook(() => useErpData('m-unmount'), { wrapper })
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(mockFetchErpMaterial).toHaveBeenCalledTimes(1))

    unmount()

    expect(capturedSignal?.aborted).toBe(true)

    await act(async () => {
      resolveFetch(makeMaterial({ modelId: 'm-unmount' }))
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
