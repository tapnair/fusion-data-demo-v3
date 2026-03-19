import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNavContext } from '../context/NavContext'
import type { NavNode, NavNodeType } from '../types/nav.types'

// Valid tab keys
const VALID_TABS = ['details', 'users', 'contents', 'bom', 'view'] as const
type TabKey = typeof VALID_TABS[number]

// Build a URL path from a NavNode and active tab.
// React Router handles the basename automatically so paths start with /dashboard.
function buildUrl(node: NavNode | null, tab: string): string {
  if (!node || node.type === 'load-more') return '/dashboard'

  const id = encodeURIComponent(node.entityId)
  let path: string
  switch (node.type) {
    case 'hub':     path = `/dashboard/hub/${id}`;     break
    case 'project': path = `/dashboard/project/${id}`; break
    case 'folder':  path = `/dashboard/folder/${id}`;  break
    case 'item':    path = `/dashboard/item/${id}`;    break
    default:        return '/dashboard'
  }

  const params = new URLSearchParams()
  if (node.projectId && node.type === 'folder') params.set('projectId', node.projectId)
  if (node.hubId    && node.type === 'item')    params.set('hubId', node.hubId)
  if (tab && tab !== 'details') params.set('tab', tab)

  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

// Parse the current location into { type, entityId, tab, hubId, projectId }
function parseLocation(pathname: string, search: string) {
  // pathname from useLocation() is already stripped of basename by React Router
  // e.g. "/dashboard/folder/urn%3Axxx"
  const parts = pathname.split('/').filter(Boolean)
  // parts: ['dashboard', type?, encodedEntityId?]
  const type = parts[1] as NavNodeType | undefined
  const entityId = parts[2] ? decodeURIComponent(parts[2]) : undefined
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  const hubId = params.get('hubId') ?? undefined
  const projectId = params.get('projectId') ?? undefined
  return { type, entityId, tab, hubId, projectId }
}

export function useNavRouting(
  activeTab: string,
  setActiveTab: (tab: TabKey) => void
) {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedNode, setSelectedNode } = useNavContext()

  // Keep a ref to the latest location so the state→URL effect never has stale location
  // without needing location in its deps (which would cause loops)
  const locationRef = useRef(location)
  useEffect(() => { locationRef.current = location })

  // ── URL → state ──────────────────────────────────────────────────────────
  // Runs whenever the browser location changes (including back/forward button).
  useEffect(() => {
    const { type, entityId, tab, hubId, projectId } = parseLocation(
      location.pathname,
      location.search
    )

    // Sync tab
    const targetTab = (tab && (VALID_TABS as readonly string[]).includes(tab)
      ? tab
      : 'details') as TabKey
    if (activeTab !== targetTab) setActiveTab(targetTab)

    // Sync selected node
    if (!type || !entityId) {
      if (selectedNode !== null) setSelectedNode(null)
      return
    }
    const nodeId = `${type}:${entityId}`
    if (selectedNode?.id === nodeId) return  // already correct — don't replace with stub

    setSelectedNode({
      id: nodeId,
      label: '',        // stub: detail components fetch their own data by entityId
      type,
      entityId,
      hubId,
      projectId,
      hasChildren: type !== 'item',
      isLoaded: false,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  // ── State → URL ───────────────────────────────────────────────────────────
  // Runs when the user selects a node or switches a tab inside the app.
  // Uses locationRef so the comparison is always against the current URL
  // without including location in deps (which would trigger on back/forward).
  useEffect(() => {
    const target = buildUrl(selectedNode, activeTab)
    const loc = locationRef.current
    const current = loc.pathname + (loc.search || '')
    if (target === current) return  // already at the right URL — skip to avoid loops
    navigate(target, { replace: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, activeTab])
}

// Exported so DetailPanel can initialise activeTab state before calling the hook.
// Reads window.location synchronously — safe for useState lazy initialiser.
export function getInitialTabFromUrl(): TabKey {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  return (tab && (VALID_TABS as readonly string[]).includes(tab) ? tab : 'details') as TabKey
}
