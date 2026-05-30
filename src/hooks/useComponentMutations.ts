import { useCallback, useState } from 'react'
import { useMutation, useApolloClient } from '@apollo/client/react'
import { SET_PROPERTIES } from '../graphql/mutations/baseProperties'
import { UPDATE_COMPONENT_DESCRIPTION } from '../graphql/mutations/component'
import {
  GET_ROOT_COMPONENT_BASE_PROPERTIES,
  GET_COMPONENT_BASE_PROPERTIES,
} from '../graphql/queries/baseProperties'
import { coercePropertyValue } from '../utils/propertyValue'

export interface ComponentMutations {
  setDescription: (componentId: string, value: string) => Promise<void>
  setBaseProperty: (
    componentId: string,
    componentState: string | null,
    definitionId: string,
    specification: string | null,
    rawValue: string
  ) => Promise<void>
  saveError: string | null
  clearSaveError: () => void
}

export function useComponentMutations(): ComponentMutations {
  const client = useApolloClient()
  const [mutate] = useMutation(SET_PROPERTIES)
  const [mutateDescription] = useMutation(UPDATE_COMPONENT_DESCRIPTION)
  const [saveError, setSaveError] = useState<string | null>(null)

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const setBaseProperty = useCallback(async (
    componentId: string,
    componentState: string | null,
    definitionId: string,
    specification: string | null,
    rawValue: string
  ): Promise<void> => {
    const coerced = coercePropertyValue(rawValue, specification)
    if (coerced.error) throw new Error(coerced.error)

    try {
      const result = await mutate({
        variables: {
          input: {
            targetId: componentId,
            propertyInputs: [{ propertyDefinitionId: definitionId, value: coerced.value }],
          },
        },
        refetchQueries: [
          'GetRootComponentBaseProperties',
          'GetComponentBaseProperties',
        ],
        awaitRefetchQueries: true,
      })

      const updatedProps = (result.data as any)?.setProperties?.properties ?? []
      if (updatedProps.length === 0) return

      // Select the correct query variant based on whether this is a root or child component
      const query = componentState === null
        ? GET_ROOT_COMPONENT_BASE_PROPERTIES
        : GET_COMPONENT_BASE_PROPERTIES
      const variables = componentState === null
        ? { componentId }
        : { componentId, state: componentState }

      try {
        const existing = client.readQuery({ query, variables }) as any
        if (!existing) return
        const existingResults: any[] = existing?.component?.baseProperties?.results ?? []
        const merged = existingResults.map((p: any) => {
          const updated = updatedProps.find((u: any) => u.definition?.id === p.definition?.id)
          return updated ?? p
        })
        client.writeQuery({
          query,
          variables,
          data: {
            component: {
              ...(existing as any).component,
              baseProperties: {
                ...(existing as any).component.baseProperties,
                results: merged,
              },
            },
          },
        })
      } catch {
        // cache miss — ignore
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save property')
      throw err
    }
  }, [mutate, client])

  const setDescription = useCallback(async (componentId: string, value: string): Promise<void> => {
    try {
      await mutateDescription({
        variables: { input: { componentId, description: value } },
        update(cache, { data }) {
          const updated = (data as any)?.updateComponentDescription
          if (!updated) return
          const id = cache.identify({ __typename: 'Component', id: updated.id })
          if (!id) return
          cache.modify({
            id,
            fields: {
              description() {
                return updated.description
              },
            },
          })
        },
        refetchQueries: ['GetViewerComponent'],
        awaitRefetchQueries: true,
      })
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save description')
      throw err
    }
  }, [mutateDescription])

  return { setDescription, setBaseProperty, saveError, clearSaveError }
}
