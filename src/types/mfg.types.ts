// Manufacturing Data Model types

export interface ComponentProperty {
  name: string
  value: string
  units?: string
}

export interface Component {
  id: string
  name: string
  description?: string
  partNumber?: string
  properties?: ComponentProperty[]
  children?: Component[]
}

export interface BOMItem {
  component: {
    id: string
    name: string
    partNumber?: string
    quantity?: number
  }
  level: number
}

export interface BOMResponse {
  component: {
    id: string
    name: string
    bom: BOMItem[]
  }
}

export interface SearchResult {
  components: Component[]
}
