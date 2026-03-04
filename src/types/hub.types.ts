// Hub related types

export interface HubAttribute {
  name: string
  value: string
}

export interface Hub {
  id: string
  name: string
  hubDataVersion?: string
  type?: string // Optional fields that may not exist in API
  region?: string
  attributes?: HubAttribute[]
}

export interface HubsResponse {
  hubs: {
    results: Hub[]
  }
}
