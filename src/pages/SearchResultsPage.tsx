import { Box } from '@mui/material'
import { SearchResultsGrid } from '../components/search/SearchResultsGrid'

export function SearchResultsPage() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SearchResultsGrid />
    </Box>
  )
}
