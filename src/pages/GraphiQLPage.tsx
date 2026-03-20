import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box } from '@mui/material'
import { GraphiQL } from 'graphiql'
import type { Fetcher } from '@graphiql/toolkit'
import { buildSchema } from 'graphql'
import 'graphiql/style.css'
import schemaSDL from '../../schema.graphql?raw'
import { useAuth } from '../context/AuthContext'
import { useNavContext } from '../context/NavContext'
import { getDefaultsForNode } from '../hooks/useGraphiQLDefaultQuery'

const schema = buildSchema(schemaSDL)

export default function GraphiQLPage() {
  const { getAccessToken } = useAuth()
  const { selectedNode } = useNavContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // Determine initial query/variables from URL params (Load in Editor) or nav selection
  const [query, setQuery] = useState<string>(() => {
    const q = searchParams.get('q')
    if (q) return decodeURIComponent(q)
    return getDefaultsForNode(selectedNode).query
  })
  const [variables, setVariables] = useState<string>(() => {
    const v = searchParams.get('v')
    if (v) return decodeURIComponent(v)
    return getDefaultsForNode(selectedNode).variables
  })

  // Key used to force-remount GraphiQL when new URL params arrive
  const [editorKey, setEditorKey] = useState(0)

  // When q/v params appear (including while already mounted), load them into the editor.
  // setSearchParams is called last so React batches the state updates together before
  // the router re-render, ensuring the new query/variables are ready when GraphiQL remounts.
  useEffect(() => {
    const q = searchParams.get('q')
    const v = searchParams.get('v')
    if (!q && !v) return
    const newQuery = q ? decodeURIComponent(q) : query
    const newVars = v ? decodeURIComponent(v) : variables
    setQuery(newQuery)
    setVariables(newVars)
    setEditorKey(k => k + 1)
    setSearchParams({}, { replace: true })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track previous node type to decide whether to update the editor on selection change
  const prevNodeTypeRef = useRef<string | null>(selectedNode?.type ?? null)

  useEffect(() => {
    const currentType = selectedNode?.type ?? null
    const prevType = prevNodeTypeRef.current

    // Same type → preserve the editor contents
    if (prevType !== null && prevType === currentType) {
      prevNodeTypeRef.current = currentType
      return
    }

    // Different type (or first selection) → replace with fresh example and remount editor
    prevNodeTypeRef.current = currentType
    const d = getDefaultsForNode(selectedNode)
    setQuery(d.query)
    setVariables(d.variables)
    setEditorKey(k => k + 1)
  }, [selectedNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Custom fetcher — calls getAccessToken fresh on every request
  const fetcher = useCallback<Fetcher>(
    async (graphqlParams) => {
      const token = await getAccessToken()
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(graphqlParams),
      })
      return res.json()
    },
    [getAccessToken]
  )

  return (
    <Box
      className="graphiql-page-root"
      sx={{ height: '100%', width: '100%', overflow: 'hidden' }}
    >
      <GraphiQL
        key={editorKey}
        fetcher={fetcher}
        schema={schema}
        defaultQuery={query}
        onEditQuery={setQuery}
        initialVariables={variables}
        onEditVariables={setVariables}
        storage={undefined}
      />
    </Box>
  )
}
