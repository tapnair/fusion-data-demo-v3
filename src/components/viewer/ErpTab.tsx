import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material'
import { useErpData } from '../../hooks/useErpData'
import type { ErpMaterial } from '../../services/erp/erpClient'

const LABEL_WIDTH = 140

interface ErpTabProps {
  modelId: string | null
}

interface Field {
  label: string
  value: string | null
}

function group(title: string, fields: Field[]) {
  const visible = fields.filter((f) => f.value !== null && f.value !== '')
  if (visible.length === 0) return null
  return (
    <Box key={title} sx={{ pb: 1 }}>
      <Typography
        variant="overline"
        sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', lineHeight: 1 }}
      >
        {title}
      </Typography>
      <Box sx={{ px: 2 }}>
        {visible.map((f) => (
          <Box
            key={f.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: `${LABEL_WIDTH}px 1fr`,
              alignItems: 'center',
              gap: 1,
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: 32,
            }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              {f.label}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              {f.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function formatCurrency(value: number, code: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value)
  } catch {
    return `${value.toFixed(2)} ${code}`
  }
}

function describeMtart(mtart: ErpMaterial['mtart']): string {
  switch (mtart) {
    case 'FERT': return 'FERT — Finished Goods'
    case 'HALB': return 'HALB — Semi-Finished'
    case 'ROH':  return 'ROH — Raw Material'
    default:     return mtart
  }
}

function describeBeskz(beskz: ErpMaterial['beskz']): string {
  return beskz === 'E' ? 'E — In-house production' : 'F — External procurement'
}

export function ErpTab({ modelId }: ErpTabProps) {
  const { loading, error, material } = useErpData(modelId)

  if (modelId === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No component selected.
        </Typography>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ px: 2, pt: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (material === null) {
    return (
      <Box sx={{ px: 2, pt: 2 }}>
        <Alert severity="info">No ERP record exists for this component.</Alert>
      </Box>
    )
  }

  return (
    <Box>
      {group('Material Master', [
        { label: 'Material No.', value: material.matnr },
        { label: 'Description', value: material.maktx },
        { label: 'Material Type', value: describeMtart(material.mtart) },
        { label: 'Base UoM', value: material.meins },
      ])}

      <Divider />

      {group('Plant / MRP', [
        { label: 'Plant', value: material.werks },
        { label: 'Plant Status', value: material.mmsta },
        { label: 'Procurement', value: describeBeskz(material.beskz) },
        { label: 'MRP Type', value: material.dismm },
        { label: 'Lead Time', value: `${material.plifz} days` },
        { label: 'Safety Stock', value: `${material.eisbe}` },
      ])}

      <Divider />

      {group('Procurement', [
        { label: 'Standard Price', value: formatCurrency(material.stprs, material.waers) },
        { label: 'Vendor No.', value: material.vendor?.lifnr ?? null },
        { label: 'Vendor', value: material.vendor?.name ?? null },
      ])}

      <Divider />

      {group('Inventory', [
        { label: 'Stock on Hand', value: `${material.bestand} ${material.meins}` },
      ])}

      <Divider />

      {group('Meta', [
        { label: 'Last Updated', value: new Date(material.lastUpdated).toLocaleString() },
      ])}
    </Box>
  )
}
