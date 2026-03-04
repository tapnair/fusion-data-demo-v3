import { useState, useEffect, useCallback } from 'react'
import { Box, Tabs, Tab, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { useNavContext } from '../../context/NavContext'
import { useAuth } from '../../context/AuthContext'
import { HubDetail } from './HubDetail'
import { ProjectDetail } from './ProjectDetail'
import { FolderDetail } from './FolderDetail'
import { ItemDetail } from './ItemDetail'
import { UsersTab } from './tabs/UsersTab'
import { BomTab } from './tabs/BomTab'
import { ViewTab } from './tabs/ViewTab'

type TabKey = 'details' | 'users' | 'bom' | 'view'

interface TabDef {
  key: TabKey
  label: string
}

function getAvailableTabs(type: string | undefined, itemSubtype: string | null): TabDef[] {
  const tabs: TabDef[] = [{ key: 'details', label: 'Details' }]
  if (type === 'project' || type === 'folder') {
    tabs.push({ key: 'users', label: 'Users' })
  }
  if (type === 'item' && itemSubtype === 'DesignItem') {
    tabs.push({ key: 'bom', label: 'BOM' })
  }
  if (type === 'item' && (itemSubtype === 'DesignItem' || itemSubtype === 'DrawingItem')) {
    tabs.push({ key: 'view', label: 'View' })
  }
  return tabs
}

export function DetailPanel() {
  const { selectedNode } = useNavContext()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [itemSubtype, setItemSubtype] = useState<string | null>(null)

  // When node changes: reset subtype, keep tab if still valid else fall back to details
  useEffect(() => {
    setItemSubtype(null)
    setActiveTab(prev => {
      const tabs = getAvailableTabs(selectedNode?.type, null)
      return tabs.some(t => t.key === prev) ? prev : 'details'
    })
  }, [selectedNode?.id])

  // When itemSubtype resolves, ensure activeTab is still valid
  useEffect(() => {
    if (itemSubtype) {
      setActiveTab(prev => {
        const tabs = getAvailableTabs(selectedNode?.type, itemSubtype)
        return tabs.some(t => t.key === prev) ? prev : 'details'
      })
    }
  }, [itemSubtype, selectedNode?.type])

  const handleTypeResolved = useCallback((typename: string) => {
    setItemSubtype(typename)
  }, [])

  if (!selectedNode) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">
          {user ? `Welcome, ${user.name}` : 'Welcome'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a hub in the left panel to begin
        </Typography>
      </Box>
    )
  }

  const availableTabs = getAvailableTabs(selectedNode.type, itemSubtype)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, value: TabKey) => setActiveTab(value)}
        >
          {availableTabs.map(tab => (
            <Tab key={tab.key} label={tab.label} value={tab.key} />
          ))}
        </Tabs>
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 'details'} sx={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'details' && (() => {
          switch (selectedNode.type) {
            case 'hub':     return <HubDetail node={selectedNode} />
            case 'project': return <ProjectDetail node={selectedNode} />
            case 'folder':  return <FolderDetail node={selectedNode} />
            case 'item':    return <ItemDetail node={selectedNode} onTypeResolved={handleTypeResolved} />
            default:        return null
          }
        })()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 'users'} sx={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'users' && <UsersTab />}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 'bom'} sx={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'bom' && <BomTab />}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 'view'} sx={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'view' && <ViewTab />}
      </Box>
    </Box>
  )
}
