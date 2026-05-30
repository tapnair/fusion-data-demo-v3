/**
 * useViewerTranslation
 * Drives the APS Model Derivative translation lifecycle.
 *
 * Flow (triggered only when ViewTab mounts — i.e. user clicks the View tab):
 *   1. GET tip version URN from Data Management API  (folded into 'submitting' spinner)
 *   2. GET manifest — branch on existing translation state:
 *        - 'success'                 → go straight to 'ready' (skip POST + polling)
 *        - null / 'failed' / 'timeout' → POST translation job
 *        - 'inprogress' / 'pending'  → skip POST, job already running
 *   3. Poll GET manifest until status === 'success' or terminal failure
 *      (first poll runs immediately; subsequent polls every 5 s)
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

    async function pollOnce(token: string, encoded: string): Promise<'keep' | 'stop'> {
      try {
        const result = await getManifest(encoded, token)
        if (cancelledRef.current) return 'stop'

        if (!result) {
          setStatus('failed')
          setError('Translation manifest unavailable.')
          return 'stop'
        }

        setProgress(result.progress)

        if (result.status === 'success') {
          setStatus('ready')
          return 'stop'
        }
        if (result.status === 'failed' || result.status === 'timeout') {
          setStatus('failed')
          setError(`Translation ${result.status}.`)
          return 'stop'
        }
        return 'keep'
      } catch (err) {
        if (cancelledRef.current) return 'stop'
        setStatus('failed')
        setError(err instanceof Error ? err.message : 'Polling error.')
        return 'stop'
      }
    }

    async function startPolling(token: string, encoded: string) {
      if (cancelledRef.current) return
      setStatus('polling')

      const initial = await pollOnce(token, encoded)
      if (cancelledRef.current || initial === 'stop') return

      intervalRef.current = setInterval(async () => {
        if (cancelledRef.current) {
          clearPollInterval()
          return
        }
        const r = await pollOnce(token, encoded)
        if (r === 'stop') clearPollInterval()
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

        // Step 2: check manifest before POSTing — avoid re-triggering translation
        // when a viewable already exists (the common case on repeat tab visits).
        const existing = await getManifest(derivativeUrn, token)
        if (cancelledRef.current) return

        if (existing?.status === 'success') {
          setProgress(existing.progress)
          setStatus('ready')
          return
        }

        // POST when no job exists or the prior attempt is terminally bad.
        // Skip when 'inprogress' / 'pending' — job is already running, just poll.
        const needsTrigger =
          !existing || existing.status === 'failed' || existing.status === 'timeout'
        if (needsTrigger) {
          await triggerTranslation(derivativeUrn, token)
          if (cancelledRef.current) return
        }

        // Step 3: poll manifest until complete (immediate first check)
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
