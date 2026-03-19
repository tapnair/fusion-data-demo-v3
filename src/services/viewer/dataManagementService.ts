/**
 * Data Management Service
 * Thin REST client for the APS Data Management API v2.
 * Used to resolve a lineage URN → derivative URN before Model Derivative translation.
 */

const DM_BASE = 'https://developer.api.autodesk.com/data/v1'

/**
 * Returns the derivative URN for the tip (latest) version of an item.
 *
 * The derivative URN is taken from `data.relationships.derivatives.data.id`
 * on the version object — this is already the base64-encoded URN that the
 * Model Derivative API expects (do NOT re-encode it).
 *
 * @param dmProjectId  DM API project ID in "b.xxx" format
 * @param lineageUrn   Item lineage URN ("urn:adsk.wipprod:dm.lineage:xxx")
 * @param token        APS bearer token
 */
export async function getDerivativeUrn(
  dmProjectId: string,
  lineageUrn: string,
  token: string
): Promise<string> {
  const encodedItemId = encodeURIComponent(lineageUrn)
  const response = await fetch(
    `${DM_BASE}/projects/${dmProjectId}/items/${encodedItemId}/tip`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Data Management getTipVersion failed: ${response.status} ${response.statusText}`
    )
  }

  const body = await response.json()

  // The derivative URN is already base64-encoded — use it directly with Model Derivative
  const derivativeUrn: string | undefined =
    body?.data?.relationships?.derivatives?.data?.id

  if (!derivativeUrn) {
    throw new Error(
      'No derivative relationship found for this item version. The item may not support translation.'
    )
  }

  return derivativeUrn
}
