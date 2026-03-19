/**
 * Model Derivative Service
 * Pure REST client for the Autodesk Model Derivative API v2.
 * No React dependencies — safe to use in hooks and plain async code.
 */

const BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2/designdata'

/**
 * base64url-encode a lineage URN (no padding) for Model Derivative input.
 * e.g. "urn:adsk.wipprod:dm.lineage:xxx" → base64url string
 */
export function encodeUrn(urn: string): string {
  return btoa(urn).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export type ManifestStatus = 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'

export interface ManifestResult {
  status: ManifestStatus
  progress: string // e.g. "50%" or "complete"
}

/**
 * GET manifest for the encoded URN.
 * Returns null if 404 (no translation submitted yet).
 * Throws on other HTTP errors.
 */
export async function getManifest(
  encodedUrn: string,
  token: string
): Promise<ManifestResult | null> {
  const response = await fetch(`${BASE_URL}/${encodedUrn}/manifest`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Model Derivative getManifest failed: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()

  return {
    status: data.status as ManifestStatus,
    progress: data.progress ?? 'pending',
  }
}

/**
 * POST translation job: SVF2 format, ["2d", "3d"] views.
 * Safe to call even if job already exists (API is idempotent).
 * Treats 409 (conflict / job already exists) as success.
 */
export async function triggerTranslation(encodedUrn: string, token: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        urn: encodedUrn,
      },
      output: {
        formats: [
          {
            type: 'svf2',
            views: ['2d', '3d'],
          },
        ],
      },
    }),
  })

  // 409 means a job already exists — treat as success (idempotent)
  if (response.status === 409) {
    return
  }

  if (!response.ok) {
    throw new Error(
      `Model Derivative triggerTranslation failed: ${response.status} ${response.statusText}`
    )
  }
}
