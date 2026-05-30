export interface ErpMaterial {
  modelId: string
  matnr: string
  maktx: string
  meins: string
  mtart: 'FERT' | 'HALB' | 'ROH'
  werks: string
  mmsta: 'ACTIVE' | 'BLOCKED' | 'OBSOLETE'
  beskz: 'E' | 'F'
  dismm: string
  plifz: number
  eisbe: number
  stprs: number
  waers: string
  bestand: number
  vendor: { lifnr: string; name: string } | null
  lastUpdated: string
}

export class ErpAuthError extends Error {
  constructor() {
    super('ERP request unauthorized (token expired or invalid)')
    this.name = 'ErpAuthError'
  }
}

export async function fetchErpMaterial(
  modelId: string,
  apsAccessToken: string,
  signal?: AbortSignal
): Promise<ErpMaterial | null> {
  const baseUrl = import.meta.env.VITE_ERP_ENDPOINT_URL
  if (!baseUrl) {
    throw new Error('VITE_ERP_ENDPOINT_URL not configured')
  }
  const url = `${baseUrl}?modelId=${encodeURIComponent(modelId)}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apsAccessToken}` },
    signal,
  })
  if (resp.status === 404) return null
  if (resp.status === 401) throw new ErpAuthError()
  if (!resp.ok) {
    throw new Error(`ERP request failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as ErpMaterial
}
