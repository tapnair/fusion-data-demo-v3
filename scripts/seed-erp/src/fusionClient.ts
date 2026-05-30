import { GraphQLClient, gql } from 'graphql-request'

export interface ComponentInfo {
  modelId: string
  componentId: string
  name: string
  partNumber: string | null
  description: string | null
  materialName: string | null
}

const GET_ROOT_MODEL = gql`
  query GetRootModel($modelId: ID!) {
    model(modelId: $modelId) {
      id
      component {
        id
        name { displayValue }
        partNumber { displayValue }
        description { displayValue }
        materialName { displayValue }
      }
    }
  }
`

const GET_UNIQUE_SUBMODELS = gql`
  query GetUniqueSubmodels($modelId: ID!, $depth: Int!, $cursor: String) {
    model(modelId: $modelId) {
      id
      uniqueAssemblyRelations(depth: $depth, pagination: { cursor: $cursor, limit: 100 }) {
        pagination { cursor }
        results {
          toModel {
            id
            component {
              id
              name { displayValue }
              partNumber { displayValue }
              description { displayValue }
              materialName { displayValue }
            }
          }
        }
      }
    }
  }
`

function flatten(component: any, modelId: string): ComponentInfo | null {
  if (!component?.id) return null
  return {
    modelId,
    componentId: component.id,
    name: component.name?.displayValue ?? '',
    partNumber: component.partNumber?.displayValue ?? null,
    description: component.description?.displayValue ?? null,
    materialName: component.materialName?.displayValue ?? null,
  }
}

export function createFusionClient(endpoint: string, token: string): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function fetchRootComponent(
  client: GraphQLClient,
  modelId: string
): Promise<ComponentInfo | null> {
  const data: any = await client.request(GET_ROOT_MODEL, { modelId })
  const model = data?.model
  if (!model) return null
  return flatten(model.component, model.id)
}

export async function fetchAllSubcomponents(
  client: GraphQLClient,
  rootModelId: string,
  depth: number
): Promise<ComponentInfo[]> {
  const out: ComponentInfo[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const data: any = await client.request(GET_UNIQUE_SUBMODELS, {
      modelId: rootModelId,
      depth,
      cursor,
    })
    const relations = data?.model?.uniqueAssemblyRelations
    const results: any[] = relations?.results ?? []
    for (const rel of results) {
      const toModel = rel?.toModel
      if (!toModel?.id || seen.has(toModel.id)) continue
      seen.add(toModel.id)
      const info = flatten(toModel.component, toModel.id)
      if (info) out.push(info)
    }
    cursor = relations?.pagination?.cursor ?? null
  } while (cursor)
  return out
}
