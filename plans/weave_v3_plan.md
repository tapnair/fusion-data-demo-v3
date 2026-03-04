# Weave V3 Theme Integration Plan
## Fusion Data Demo Application

> **Goal:** Replace the current MUI purple gradient theme with Autodesk Weave 3 design system, adding support for 3 color schemes and 3 density levels while maintaining all existing authentication and API functionality.

---

## Overview

This plan details the integration of the Weave 3 design system from the reference implementation at `/Users/rainsbp/_local_rainsbp/Claude/Weave3POC` into the fusion-data-demo-v3 application. The application will retain all current features (PKCE authentication, Manufacturing Data Model API integration, hub browsing) while gaining Weave 3's professional appearance and theme flexibility.

## User Requirements Summary

Based on Q&A session, the following decisions have been made:

1. **Theme Switcher Location**: Dropdown menu in top right corner (Settings icon)
2. **Theme Switcher Visibility**: Authenticated pages only (Dashboard, HubsPage)
3. **Theme Persistence**: Use localStorage to remember user preferences
4. **Home Page Behavior**: Display last used theme from cache (no switcher shown)
5. **Weave 3 Icons**: Copy and use all 198 SVG icons
6. **W3C Token File**: Include Tokens_w3c.json reference file
7. **MUI X Packages**: Install all optional packages (DataGrid Premium, DatePickers Pro, TreeView, Charts)

---

## Current State Analysis

### Existing Application
- **Framework**: Vite + React 19 + TypeScript
- **UI Library**: Material-UI v7.3.8
- **Current Theme**: Custom purple gradient theme (`#667eea` / `#764ba2`)
- **Features**:
  - OAuth 2.0 PKCE authentication with Autodesk Platform Services
  - Manufacturing Data Model API v3 GraphQL integration
  - Hub listing and display
  - Protected routing
  - Session-based authentication

### Weave3POC Reference
- **Theme System**: `createWeaveTheme({ colorScheme, density })` factory
- **Color Schemes**: `light-gray`, `dark-gray`, `dark-blue`
- **Densities**: `medium`, `high`, `low`
- **Tokens**: 2200+ design tokens from Figma
- **Components**: 30+ MUI component overrides
- **Typography**: ArtifaktElement font family
- **Icons**: 198 Weave 3 SVG icons (optional)

---

## Integration Strategy

### Approach
**Incremental replacement** — copy the Weave 3 theme infrastructure and gradually replace existing components while maintaining functionality at every step.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Theme replacement | Complete replacement | Current purple theme is custom; Weave 3 provides enterprise-grade design |
| Color scheme default | `light-gray` | Matches Autodesk product standards |
| Density default | `medium` | Standard Weave 3 density |
| Theme switcher | Dropdown menu in top right (authenticated pages only) | Clean UI, accessible only when logged in |
| Theme persistence | localStorage | Remember user's theme preference across sessions |
| Home page theme | Use cached theme from localStorage | Consistent experience pre/post-login |
| Token files | Copy all from Weave3POC | Maintain full design token library |
| Fonts | Copy ArtifaktElement files | Offline-first, no CDN dependency |
| Icons | Copy Weave 3 SVG icons (all 198 icons) | Use Weave 3 design language throughout |
| Component overrides | Copy all | Ensure consistent Weave 3 appearance |
| MUI X packages | Install all (DataGrid, DatePickers, TreeView, Charts) | Enable advanced Weave 3 showcase components |
| Existing functionality | Preserve 100% | No breaking changes to auth/API |

---

## File Changes Summary

### Files to Copy (from Weave3POC)

```
Weave3POC/ → fusion-data-demo-v3/
├── Tokens_w3c.json                        → public/Tokens_w3c.json
├── fonts/                                 → public/fonts/
├── icons/                                 → public/icons/
├── weave3-showcase/src/fonts.css         → src/theme/fonts.css
└── weave3-showcase/src/theme/
    ├── tokens/                           → src/theme/tokens/
    │   ├── colors.ts
    │   ├── theme.ts
    │   ├── density.ts
    │   ├── typography.ts
    │   └── index.ts
    ├── base/                             → src/theme/base/
    │   ├── palette.ts
    │   ├── typography.ts
    │   ├── spacing.ts
    │   ├── shape.ts
    │   ├── shadows.ts
    │   └── index.ts
    ├── overrides/                        → src/theme/overrides/
    │   └── index.ts                      (all component overrides)
    ├── createWeaveTheme.ts               → src/theme/createWeaveTheme.ts
    ├── types.ts                          → src/theme/types.ts
    └── index.ts                          → src/theme/index.ts
```

### Files to Modify

```
fusion-data-demo-v3/src/
├── App.tsx                               Update ThemeProvider, add theme state
├── theme/theme.ts                        DELETE (replace with createWeaveTheme)
├── components/layout/Header.tsx          Add color scheme + density dropdowns
├── pages/
│   ├── Home.tsx                          Apply Weave 3 spacing/colors
│   ├── Dashboard.tsx                     Apply Weave 3 styling
│   └── HubsPage.tsx                      Apply Weave 3 styling
└── components/
    ├── hubs/HubCard.tsx                  Apply Weave 3 Card styles
    ├── hubs/HubList.tsx                  Update Grid spacing
    ├── common/LoadingSpinner.tsx         Use Weave 3 CircularProgress
    └── common/ErrorMessage.tsx           Use Weave 3 Alert styles
```

---

## Phase 1: Copy Weave 3 Theme Infrastructure

**Goal**: Set up all Weave 3 theme files without breaking existing functionality.

### Tasks

1. **Copy token files**
   ```bash
   cp -r /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/tokens \
         src/theme/tokens
   ```

2. **Copy base theme builders**
   ```bash
   cp -r /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/base \
         src/theme/base
   ```

3. **Copy component overrides**
   ```bash
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/overrides/index.ts \
      src/theme/overrides/index.ts
   ```

4. **Copy theme factory and types**
   ```bash
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/createWeaveTheme.ts \
      src/theme/createWeaveTheme.ts
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/types.ts \
      src/theme/types.ts
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/theme/index.ts \
      src/theme/index.ts
   ```

5. **Copy fonts**
   ```bash
   mkdir -p public/fonts
   cp -r /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/fonts/* public/fonts/
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/weave3-showcase/src/fonts.css \
      src/theme/fonts.css
   ```

6. **Copy Weave 3 icons**
   ```bash
   mkdir -p public/icons
   cp -r /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/icons/* public/icons/
   ```

7. **Copy W3C token reference**
   ```bash
   cp /Users/rainsbp/_local_rainsbp/Claude/Weave3POC/Tokens_w3c.json public/
   ```

8. **Install MUI X packages**
   ```bash
   npm install @mui/x-data-grid-premium@^8.27.3 \
               @mui/x-date-pickers-pro@^8.27.2 \
               @mui/x-tree-view@^8.27.2 \
               @mui/x-charts@^8.27.0 \
               dayjs@^1.11.19
   ```

**Acceptance Criteria**: All files copied successfully, TypeScript compiles without errors.

---

## Phase 2: Update App.tsx with Weave Theme and localStorage

**Goal**: Replace the purple gradient theme with Weave 3 theme factory and add localStorage persistence.

### Changes to `src/App.tsx`

```typescript
import React, { useState, useMemo, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider, StyledEngineProvider, CssBaseline } from '@mui/material'
import { createWeaveTheme } from './theme/createWeaveTheme'
import type { WeaveColorScheme, WeaveDensity } from './theme/types'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Callback from './pages/Callback'
import Dashboard from './pages/Dashboard'
import HubsPage from './pages/HubsPage'
import DebugPage from './pages/DebugPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import './theme/fonts.css'

// localStorage keys
const THEME_STORAGE_KEY = 'weave-color-scheme'
const DENSITY_STORAGE_KEY = 'weave-density'

function App() {
  // Initialize from localStorage or use defaults
  const [colorScheme, setColorScheme] = useState<WeaveColorScheme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return (stored as WeaveColorScheme) || 'light-gray'
  })

  const [density, setDensity] = useState<WeaveDensity>(() => {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY)
    return (stored as WeaveDensity) || 'medium'
  })

  // Persist theme changes to localStorage
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, colorScheme)
  }, [colorScheme])

  useEffect(() => {
    localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  const theme = useMemo(
    () => createWeaveTheme({ colorScheme, density }),
    [colorScheme, density]
  )

  return (
    <StyledEngineProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/callback" element={<Callback />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard
                      colorScheme={colorScheme}
                      density={density}
                      onColorSchemeChange={setColorScheme}
                      onDensityChange={setDensity}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hubs"
                element={
                  <ProtectedRoute>
                    <HubsPage
                      colorScheme={colorScheme}
                      density={density}
                      onColorSchemeChange={setColorScheme}
                      onDensityChange={setDensity}
                    />
                  </ProtectedRoute>
                }
              />
              <Route path="/debug" element={<DebugPage />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

export default App
```

### Delete Old Theme

```bash
rm src/theme/theme.ts
```

**Acceptance Criteria**:
- App renders with Weave 3 theme (defaults or from localStorage)
- Theme preference persists across browser sessions
- No console errors

---

## Phase 3: Add Theme Switcher to Header (Authenticated Pages Only)

**Goal**: Add a dropdown menu in the top right corner for theme switching on authenticated pages.

### Update `src/components/layout/Header.tsx`

Add a Settings/Options menu with theme controls:

```typescript
import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  Box,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckIcon from '@mui/icons-material/Check'
import { LogoutButton } from '../auth/LogoutButton'
import type { WeaveColorScheme, WeaveDensity } from '../../theme/types'

interface HeaderProps {
  colorScheme?: WeaveColorScheme
  density?: WeaveDensity
  onColorSchemeChange?: (scheme: WeaveColorScheme) => void
  onDensityChange?: (density: WeaveDensity) => void
}

export function Header({
  colorScheme = 'light-gray',
  density = 'medium',
  onColorSchemeChange,
  onDensityChange,
}: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleColorSchemeChange = (scheme: WeaveColorScheme) => {
    onColorSchemeChange?.(scheme)
    handleMenuClose()
  }

  const handleDensityChange = (densityValue: WeaveDensity) => {
    onDensityChange?.(densityValue)
    handleMenuClose()
  }

  const showThemeSwitcher = onColorSchemeChange && onDensityChange

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Fusion Data Demo
        </Typography>

        {showThemeSwitcher && (
          <>
            <IconButton
              color="inherit"
              onClick={handleMenuOpen}
              aria-label="theme settings"
              sx={{ mr: 1 }}
            >
              <SettingsIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <ListItemText primary="Color Scheme" primaryTypographyProps={{ fontWeight: 600 }} />
              </MenuItem>
              <MenuItem onClick={() => handleColorSchemeChange('light-gray')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {colorScheme === 'light-gray' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="Light Gray" />
              </MenuItem>
              <MenuItem onClick={() => handleColorSchemeChange('dark-gray')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {colorScheme === 'dark-gray' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="Dark Gray" />
              </MenuItem>
              <MenuItem onClick={() => handleColorSchemeChange('dark-blue')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {colorScheme === 'dark-blue' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="Dark Blue" />
              </MenuItem>

              <Divider sx={{ my: 1 }} />

              <MenuItem disabled>
                <ListItemText primary="Density" primaryTypographyProps={{ fontWeight: 600 }} />
              </MenuItem>
              <MenuItem onClick={() => handleDensityChange('high')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {density === 'high' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="High (Compact)" />
              </MenuItem>
              <MenuItem onClick={() => handleDensityChange('medium')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {density === 'medium' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="Medium" />
              </MenuItem>
              <MenuItem onClick={() => handleDensityChange('low')}>
                <Box sx={{ width: 24, mr: 1 }}>
                  {density === 'low' && <CheckIcon fontSize="small" />}
                </Box>
                <ListItemText primary="Low (Comfortable)" />
              </MenuItem>
            </Menu>
          </>
        )}

        <LogoutButton />
      </Toolbar>
    </AppBar>
  )
}
```

### Update Page Components

Update `Dashboard.tsx` and `HubsPage.tsx` to accept and pass through theme props:

```typescript
interface PageProps {
  colorScheme: WeaveColorScheme
  density: WeaveDensity
  onColorSchemeChange: (scheme: WeaveColorScheme) => void
  onDensityChange: (density: WeaveDensity) => void
}

function HubsPage({ colorScheme, density, onColorSchemeChange, onDensityChange }: PageProps) {
  // ... existing code
  return (
    <>
      <Header
        colorScheme={colorScheme}
        density={density}
        onColorSchemeChange={onColorSchemeChange}
        onDensityChange={onDensityChange}
      />
      {/* ... rest of component */}
    </>
  )
}
```

### Update Home Page

The Home page does NOT receive theme switcher props, but will display using the cached theme from localStorage:

```typescript
function Home() {
  // ... existing code
  // No theme switcher - just renders with current theme from App.tsx
}
```

**Acceptance Criteria**:
- Settings icon appears in top right corner on authenticated pages only
- Clicking opens dropdown menu with color scheme and density options
- Current selections are indicated with checkmarks
- Switching theme updates entire UI in real-time and persists to localStorage
- Home page does not show theme switcher

---

## Phase 4: Apply Weave 3 Styling to Components

**Goal**: Update all custom components to use Weave 3 design tokens and spacing.

### Component Updates

#### 1. `src/pages/Home.tsx`

Update spacing and remove custom gradients:

```typescript
// Remove custom gradient from title
<Typography
  variant="h2"
  component="h1"
  gutterBottom
  sx={{
    fontWeight: 700,
    color: 'primary.main',  // Use Weave 3 primary color
  }}
>
  Fusion Data Demo
</Typography>
```

Update spacing to use theme values:

```typescript
<Container maxWidth="lg" sx={{ py: 6 }}>  // Weave spacing
  <Box sx={{ textAlign: 'center', mb: 6 }}>
    {/* ... */}
  </Box>
  <Box sx={{ mb: 4 }}>
    {/* ... */}
  </Box>
</Container>
```

#### 2. `src/components/hubs/HubCard.tsx`

Apply Weave 3 Card styling:

```typescript
<Card
  onClick={handleClick}
  sx={{
    height: '100%',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: 2,  // Weave 3 elevation
    },
  }}
>
  <CardContent>
    <FolderIcon
      color="primary"
      sx={{ fontSize: 48, mb: 2 }}
    />
    <Typography variant="h6" gutterBottom>
      {hub.name}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      ID: {hub.id}
    </Typography>
    {hub.hubDataVersion && (
      <Chip
        label={`v${hub.hubDataVersion}`}
        size="small"
        sx={{ mt: 1 }}
      />
    )}
  </CardContent>
</Card>
```

#### 3. `src/components/common/ErrorMessage.tsx`

Use Weave 3 Alert component:

```typescript
<Alert
  severity="error"
  action={
    onRetry && (
      <Button color="inherit" size="small" onClick={onRetry}>
        Retry
      </Button>
    )
  }
>
  <AlertTitle>{message}</AlertTitle>
  {error?.message || 'An unexpected error occurred'}
</Alert>
```

#### 4. `src/components/common/LoadingSpinner.tsx`

Update CircularProgress styling:

```typescript
<Box
  sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    gap: 2,  // Weave spacing
  }}
>
  <CircularProgress />
  {message && (
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  )}
</Box>
```

**Acceptance Criteria**: All components render with Weave 3 styling, spacing follows design tokens.

---

## Phase 5: Update Typography and Spacing

**Goal**: Ensure all text uses ArtifaktElement font and Weave 3 type scales.

### Import Fonts in `index.html`

Update `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fusion Data Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Font loading is handled by `src/theme/fonts.css` which is imported in App.tsx.

### Verify Typography Scales

All components should use MUI Typography variants which now map to Weave 3 scales:

- `h1` → 28px (xxl)
- `h2` → 24px (xl)
- `h3` → 16px (l)
- `h4` → 16px (l)
- `h5` → 14px (m)
- `h6` → 12px (s)
- `body1` → 14px (m)
- `body2` → 12px (s)
- `button` → 14px (m)

**Acceptance Criteria**: All text renders in ArtifaktElement font, sizes match Weave 3 spec.

---

## Phase 6: Testing and Validation

**Goal**: Verify all 9 theme combinations work correctly with existing functionality.

### Test Matrix

| Color Scheme | Density | Tests |
|---|---|---|
| light-gray | medium | ✓ Login flow, hub loading, navigation |
| light-gray | high | ✓ Compact layout, all components visible |
| light-gray | low | ✓ Spacious layout, readability |
| dark-gray | medium | ✓ Dark theme colors, contrast ratios |
| dark-gray | high | ✓ Compact dark layout |
| dark-gray | low | ✓ Spacious dark layout |
| dark-blue | medium | ✓ Navy theme, brand alignment |
| dark-blue | high | ✓ Compact navy layout |
| dark-blue | low | ✓ Spacious navy layout |

### Functionality Tests

For each theme combination:

1. ✓ Home page renders correctly
2. ✓ Login button works
3. ✓ OAuth PKCE flow completes
4. ✓ Callback page handles token exchange
5. ✓ Dashboard loads with user info
6. ✓ Hubs page fetches and displays hubs
7. ✓ Hub cards display all fields (name, ID, hubDataVersion)
8. ✓ Theme switcher updates UI in real-time
9. ✓ Logout works correctly
10. ✓ Protected routes redirect when not authenticated

### Visual Validation

- Typography: All text uses ArtifaktElement font
- Spacing: Consistent spacing per density level
- Colors: Primary blue `#006da2`, semantic colors match Weave 3
- Shadows: Weave 3 elevation system applied
- Border radius: Weave 3 border radius values (4px, 6px, 12px)
- Focus states: Weave 3 double-border focus ring on interactive elements

**Acceptance Criteria**: All 9 themes render correctly, all functionality preserved.

---

## Phase 7: Documentation and Cleanup

**Goal**: Document the integration and remove unused code.

### Tasks

1. **Update README.md**
   - Add Weave 3 theme information
   - Document color schemes and densities
   - Add screenshot of theme switcher
   - Credit Weave 3 design system

2. **Create THEME.md**
   - Document Weave 3 integration
   - Explain theme factory usage
   - List all available design tokens
   - Show how to add new components

3. **Remove unused files**
   ```bash
   rm src/theme/theme.ts  # Old purple gradient theme
   ```

4. **Add comments**
   - Mark Weave 3 token references
   - Document custom overrides
   - Note any deviations from Weave 3 spec

5. **Verify file structure**
   - Ensure all Weave 3 assets are in public/ directory
   - Verify all 198 icons copied successfully
   - Check fonts are accessible
   - Confirm Tokens_w3c.json is present for reference

**Acceptance Criteria**: Documentation complete, no unused code, clear comments.

---

## Implementation Timeline

```
Phase 1: Copy Theme Infrastructure           ~30 minutes
Phase 2: Update App.tsx                      ~15 minutes
Phase 3: Add Theme Switcher                  ~30 minutes
Phase 4: Update Components                   ~1 hour
Phase 5: Typography and Spacing              ~30 minutes
Phase 6: Testing and Validation              ~1 hour
Phase 7: Documentation                       ~30 minutes

Total estimated time: ~4.5 hours
```

---

## Rollback Plan

If issues arise, the integration can be rolled back by:

1. Restore `src/theme/theme.ts` from git history
2. Revert `src/App.tsx` to use old theme
3. Remove Weave 3 theme directories
4. Restore original component styling

Git checkpoint before starting:
```bash
git checkout -b weave3-integration
git commit -am "Checkpoint before Weave 3 integration"
```

---

## Benefits of Weave 3 Integration

1. **Professional Appearance**: Enterprise-grade design system used across Autodesk products
2. **Flexibility**: 9 theme combinations (3 color schemes × 3 densities)
3. **Accessibility**: Weave 3 includes WCAG-compliant color contrasts and focus states
4. **Consistency**: Matches other Autodesk tools and services
5. **Maintainability**: Design tokens make updates easier
6. **Brand Alignment**: Uses official Autodesk design language
7. **Dark Mode**: Built-in support for dark themes
8. **Density Options**: Adapt UI for different use cases (compact data tables, comfortable browsing)

---

## Dependencies

### Already Installed

These packages are already in the project:

- `@mui/material@^7.0.0` ✓ (already installed: 7.3.8)
- `@emotion/react@^11.14.0` ✓ (already installed: 11.14.0)
- `@emotion/styled@^11.14.0` ✓ (already installed: 11.14.1)
- `@mui/icons-material@^7.0.0` ✓ (already installed: 7.3.8)

### To Install

MUI X packages for advanced Weave 3 components:

```bash
npm install @mui/x-data-grid-premium@^8.27.3 \
            @mui/x-date-pickers-pro@^8.27.2 \
            @mui/x-tree-view@^8.27.2 \
            @mui/x-charts@^8.27.0 \
            dayjs@^1.11.19
```

Note: Some MUI X packages may require licenses for production use. Check MUI licensing requirements.

---

## Success Criteria

The integration is successful when:

1. ✓ All 9 theme combinations render correctly
2. ✓ All existing functionality (auth, API, navigation) works unchanged
3. ✓ Theme switcher appears in dropdown menu (top right) on authenticated pages only
4. ✓ Theme switcher does NOT appear on Home page
5. ✓ Theme preferences persist in localStorage across sessions
6. ✓ Home page displays last used theme from cache
7. ✓ Typography uses ArtifaktElement font throughout
8. ✓ Spacing and colors match Weave 3 specification
9. ✓ Focus states show Weave 3 double-border ring
10. ✓ Dark themes have proper contrast and readability
11. ✓ All 198 Weave 3 SVG icons copied successfully
12. ✓ MUI X packages installed and available
13. ✓ No console errors or TypeScript errors
14. ✓ Documentation is complete and accurate
15. ✓ Code is clean with no unused files

---

## Next Steps After Integration

1. **Create Icon Components**: Build React components from Weave 3 SVG icons for easier usage
2. **Add More Components**: Integrate additional showcase components (DataGrid, DatePickers, TreeView, Charts)
3. **Create Design System Guide**: Document Weave 3 usage patterns for the team
4. **Performance Optimization**: Lazy load theme variants and large components
5. **Enhanced Theme Persistence**: Consider syncing theme preferences with user profile API
6. **A11y Testing**: Validate WCAG compliance across all 9 theme combinations

---

*Plan created: 2026-03-03*
*Updated with user requirements: 2026-03-03*
*Reference: `/Users/rainsbp/_local_rainsbp/Claude/Weave3POC`*
*Target: `/Users/rainsbp/_local_rainsbp/Claude/fusion-data-demo-v3`*

---

## Implementation Notes

- Theme switcher implemented as dropdown menu (not separate selects)
- Settings icon used for theme menu trigger
- CheckIcon indicates current selections in menu
- localStorage keys: `weave-color-scheme` and `weave-density`
- All MUI X packages will be installed for full Weave 3 component library
- Weave 3 SVG icons available in `public/icons/` directory
- Token reference available at `public/Tokens_w3c.json`
