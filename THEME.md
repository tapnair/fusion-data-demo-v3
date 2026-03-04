# Weave 3 Theme System Documentation

## Overview

This application uses the **Autodesk Weave 3 Design System**, providing enterprise-grade theming with 9 unique theme combinations (3 color schemes × 3 density levels).

## Architecture

### Theme Factory

The theme is created using the `createWeaveTheme()` factory function:

```typescript
import { createWeaveTheme } from './theme/createWeaveTheme'

const theme = createWeaveTheme({
  colorScheme: 'light-gray', // 'light-gray' | 'dark-gray' | 'dark-blue'
  density: 'medium'           // 'high' | 'medium' | 'low'
})
```

### Color Schemes

| Scheme | Description | Use Case |
|---|---|---|
| `light-gray` | Light theme with gray surfaces | Default, general use |
| `dark-gray` | Dark theme with dark gray surfaces | Low-light environments |
| `dark-blue` | Dark theme with navy blue surfaces | Brand-aligned dark mode |

### Density Levels

| Density | Description | Spacing | Font Size | Use Case |
|---|---|---|---|---|
| `high` | Compact | Tight | Smaller | Data-dense interfaces, power users |
| `medium` | Balanced | Standard | Standard | General use (default) |
| `low` | Comfortable | Spacious | Larger | Improved readability, accessibility |

## Theme Persistence

User theme preferences are stored in `localStorage`:

```typescript
// Keys
localStorage.getItem('weave-color-scheme') // 'light-gray' | 'dark-gray' | 'dark-blue'
localStorage.getItem('weave-density')      // 'high' | 'medium' | 'low'
```

The application automatically loads the saved theme on mount and persists changes.

## Typography

### Font Family

**ArtifaktElement** - Autodesk's official design system font

Loaded from: `https://fonts.autodesk.com/ArtifaktElement/WOFF2/`

Weights available:
- 200 (Light)
- 300 (Book)
- 400 (Regular)
- 600 (Medium)
- 700 (Bold)
- 900 (Black)

### Type Scale

Typography variants map to Weave 3 semantic sizes:

| Variant | Size (medium density) | Use Case |
|---|---|---|
| `h1` | 28px (xxl) | Page titles |
| `h2` | 24px (xl) | Section headers |
| `h3` | 16px (l) | Subsection headers |
| `h4` | 16px (l) | Card titles |
| `h5` | 14px (m) | Small headers |
| `h6` | 12px (s) | Labels |
| `body1` | 14px (m) | Default text |
| `body2` | 12px (s) | Secondary text |
| `button` | 14px (m) | Button text |

## Design Tokens

### Token Structure

Weave 3 provides 2200+ design tokens organized as:

```
src/theme/tokens/
├── colors.ts       - Generic color palette (706 values)
├── theme.ts        - Semantic tokens per color scheme (286 × 3)
├── density.ts      - Spacing/sizing tokens per density (206 × 3)
└── typography.ts   - Font families and fixed scales
```

### Key Tokens

**Colors:**
- Primary: `#006da2` (Autodesk blue)
- Error: `#d13f3f`
- Warning: `#ffc21a`
- Success: `#547919`

**Spacing (medium density):**
- xxs: 4px
- xs: 8px
- s: 12px
- m: 16px
- l: 24px
- xl: 32px
- xxl: 48px

**Border Radius (medium density):**
- s: 4px
- m: 6px
- l: 12px

## Component Overrides

All MUI components are styled using Weave 3 specifications:

```
src/theme/overrides/
└── index.ts        - Component overrides for 30+ components
```

### Key Overrides

- **Button**: Weave 3 colors, border radius, hover states
- **TextField**: Surface backgrounds, focus rings
- **Card**: Elevation, borders, hover effects
- **Alert**: Status colors, icon alignment
- **Table**: Row heights per density, striping
- **Tabs**: Active indicators, padding
- **Switches**: Toggle sizing, on/off colors

## Using the Theme

### In Components

Access theme values via the `sx` prop:

```tsx
<Box sx={{
  bgcolor: 'primary.main',      // Weave 3 primary color
  color: 'text.secondary',       // Semantic text color
  p: 3,                          // Spacing (density-aware)
  borderRadius: 1,               // Border radius (density-aware)
}}>
  Content
</Box>
```

### Theme Hook

Access the full theme object:

```tsx
import { useTheme } from '@mui/material/styles'

function MyComponent() {
  const theme = useTheme()

  console.log(theme.colorScheme) // 'light-gray' | 'dark-gray' | 'dark-blue'
  console.log(theme.density)     // 'high' | 'medium' | 'low'

  return <Box sx={{ color: theme.palette.primary.main }}>...</Box>
}
```

## Theme Switcher

The theme switcher is available on authenticated pages only (Dashboard, Hubs).

### Location

Top right corner → Settings icon (⚙️) → Dropdown menu

### Implementation

```tsx
// In authenticated pages
<Header
  colorScheme={colorScheme}
  density={density}
  onColorSchemeChange={setColorScheme}
  onDensityChange={setDensity}
/>

// In App.tsx
const [colorScheme, setColorScheme] = useState<WeaveColorScheme>(() => {
  const stored = localStorage.getItem('weave-color-scheme')
  return (stored as WeaveColorScheme) || 'light-gray'
})
```

## Accessibility

Weave 3 includes WCAG 2.1 AA compliant features:

- **Color Contrast**: All text meets minimum contrast ratios
- **Focus States**: Double-border focus ring (`#006da2` with 3px outline)
- **Keyboard Navigation**: Full keyboard support on all interactive elements
- **Typography**: Clear hierarchy with appropriate sizing

## Reference Files

- `/public/Tokens_w3c.json` - W3C token reference (310KB)
- `/public/fonts/` - ArtifaktElement font files (6 weights)
- `/public/icons/` - Weave 3 SVG icons (198 icons)

## Extending the Theme

### Adding Custom Tokens

1. Define tokens in `src/theme/tokens/`
2. Update theme factory in `createWeaveTheme.ts`
3. Add TypeScript types in `types.ts`

### Custom Component Overrides

Add to `src/theme/overrides/index.ts`:

```typescript
export function createComponentOverrides(
  colorScheme: WeaveColorScheme,
  density: WeaveDensity
): Components<Theme> {
  const t = themeTokens[colorScheme]
  const d = densityTokens[density]

  return {
    // ... existing overrides
    MuiYourComponent: {
      styleOverrides: {
        root: {
          backgroundColor: t['semantic/background-color/surface/100'],
          padding: d['semantic/spacing/variable/m'],
        },
      },
    },
  }
}
```

## Resources

- **Weave 3 POC**: `/Users/rainsbp/_local_rainsbp/Claude/Weave3POC`
- **Token Count**: 2,200+ design tokens
- **Component Overrides**: 30+ MUI components
- **Color Schemes**: 3 (9 total theme combinations)
- **Density Levels**: 3

## Support

For issues or questions about the Weave 3 integration:

1. Check `weave_v3_plan.md` for implementation details
2. Review component overrides in `src/theme/overrides/`
3. Inspect design tokens in `src/theme/tokens/`
4. Reference W3C tokens: `/public/Tokens_w3c.json`

---

*Last updated: 2026-03-03*
*Weave 3 Design System Version: 3.0*
