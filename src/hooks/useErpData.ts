import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchErpMaterial, type ErpMaterial } from '../services/erp/erpClient'

export interface UseErpDataResult {
  loading: boolean
  error: string | null
  material: ErpMaterial | null
}

// No-op kept for test-surface compatibility. The hook intentionally has no
// cache — see useErpData below.
export function clearErpCache() {}

/**
 * Fetches ERP material data by modelId.
 *
 * **No cache, by design.** This is a demo; ERP records are editable from the
 * external admin UI (`fusion-erp-api`), and the user expects every selection
 * change to reflect the latest server state. Network cost on each pick is
 * acceptable.
 */
export function useErpData(modelId: string | null): UseErpDataResult {
  const { getAccessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [material, setMaterial] = useState<ErpMaterial | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()

    if (!modelId) {
      setLoading(false)
      setError(null)
      setMaterial(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setMaterial(null)

    ;(async () => {
      try {
        const token = await getAccessToken()
        if (controller.signal.aborted) return
        const result = await fetchErpMaterial(modelId, token, controller.signal)
        if (controller.signal.aborted) return
        setMaterial(result)
        setLoading(false)
      } catch (err) {
        if (controller.signal.aborted) return
        const msg = err instanceof Error ? err.message : 'ERP lookup failed'
        setError(msg)
        setLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [modelId, getAccessToken])

  return { loading, error, material }
}
