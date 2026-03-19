/**
 * useViewerTranslation
 * Drives the APS Model Derivative translation lifecycle.
 *
 * Flow (triggered only when ViewTab mounts — i.e. user clicks the View tab):
 *   1. GET tip version URN from Data Management API  (folded into 'submitting' spinner)
 *   2. POST translation job (SVF2)
 *   3. Poll GET manifest every 5 s until status === 'success' or terminal failure
 *   4. Return 'ready' so ApsViewer can load the document
 *
 * retry() re-runs from step 1.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getManifest, triggerTranslation } from '../services/viewer/modelDerivativeService'
import { getDerivativeUrn } from '../services/viewer/dataManagementService'
import { useAuth } from '../context/AuthContext'

export type TranslationStatus =
  | 'idle'        // hook just mounted, not yet started
  | 'submitting'  // resolving version URN + POSTing translation job
  | 'polling'     // setInterval polling manifest
  | 'ready'       // manifest status === 'success'
  | 'failed'      // terminal failure

export interface ViewerTranslationState {
  status: TranslationStatus
  progress: string | null
  error: string | null
  encodedUrn: string | null  // available once version URN is resolved
}

export function useViewerTranslation(
  lineageUrn: string | null,   // node.entityId (lineage URN, not yet encoded)
  dmProjectId: string | null   // b.xxx DM project ID from node.dmProjectId
): ViewerTranslationState & { retry: () => void } {
  const { getAccessToken } = useAuth()

  const [status, setStatus] = useState<TranslationStatus>('idle')
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [encodedUrn, setEncodedUrn] = useState<string | null>(null)

  // Incrementing retryCount forces the effect to re-run for retry
  const [retryCount, setRetryCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const clearPollInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    clearPollInterval()

    if (!lineageUrn || !dmProjectId) {
      setStatus('idle')
      setProgress(null)
      setError(null)
      setEncodedUrn(null)
      return
    }

    async function startPolling(token: string, encoded: string) {
      if (cancelledRef.current) return
      setStatus('polling')

      intervalRef.current = setInterval(async () => {
        if (cancelledRef.current) {
          clearPollInterval()
          return
        }

        try {
          const result = await getManifest(encoded, token)
          if (cancelledRef.current) return

          if (!result) {
            clearPollInterval()
            setStatus('failed')
            setError('Translation manifest unavailable.')
            return
          }

          setProgress(result.progress)

          if (result.status === 'success') {
            clearPollInterval()
            setStatus('ready')
          } else if (result.status === 'failed' || result.status === 'timeout') {
            clearPollInterval()
            setStatus('failed')
            setError(`Translation ${result.status}.`)
          }
          // 'inprogress' | 'pending' → keep polling
        } catch (err) {
          if (cancelledRef.current) return
          clearPollInterval()
          setStatus('failed')
          setError(err instanceof Error ? err.message : 'Polling error.')
        }
      }, 5000)
    }

    async function run() {
      if (cancelledRef.current) return

      setStatus('submitting')
      setProgress(null)
      setError(null)
      setEncodedUrn(null)

      try {
        const token = await getAccessToken()
        if (cancelledRef.current) return

        // Step 1: resolve derivative URN from tip version (folded into 'submitting')
        // derivatives.data.id is already base64-encoded — do NOT re-encode
        const derivativeUrn = await getDerivativeUrn(dmProjectId!, lineageUrn!, token)
        if (cancelledRef.current) return

        setEncodedUrn(derivativeUrn)

        // Step 2: submit translation job (idempotent — safe to re-submit)
        await triggerTranslation(derivativeUrn, token)
        if (cancelledRef.current) return

        // Step 3: poll manifest until complete
        await startPolling(token, derivativeUrn)
      } catch (err) {
        if (cancelledRef.current) return
        setStatus('failed')
        setError(err instanceof Error ? err.message : 'Failed to start translation.')
      }
    }

    run()

    return () => {
      cancelledRef.current = true
      clearPollInterval()
    }
  }, [lineageUrn, dmProjectId, retryCount, getAccessToken, clearPollInterval])

  const retry = useCallback(() => {
    setRetryCount(c => c + 1)
  }, [])

  return { status, progress, error, encodedUrn, retry }
}
