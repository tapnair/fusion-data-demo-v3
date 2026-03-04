import { Components, Theme } from '@mui/material/styles';
import type { WeaveColorScheme, WeaveDensity } from '../types';
import { themeTokens } from '../tokens/theme';
import { densityTokens } from '../tokens/density';

export function createComponentOverrides(
  scheme: WeaveColorScheme,
  density: WeaveDensity
): Components<Theme> & Record<string, unknown> {
  const t = themeTokens[scheme];
  const d = densityTokens[density];
  const isDark = scheme !== 'light-gray';

  // Token aliases
  const primary = (t['semantic/background-color/input/primary/default'] as string) || '#006da2';
  const primaryHover = (t['semantic/background-color/input/primary/hover'] as string) || '#006698';
  const primaryPressed = (t['semantic/background-color/input/primary/pressed'] as string) || '#005f8e';
  const textDefault = (t['semantic/text-color/default'] as string) || '#363636';
  const textDimmed = (t['semantic/text-color/dimmed'] as string) || 'rgba(54,54,54,0.55)';
  const textInverse = (t['semantic/text-color/inverse'] as string) || '#ffffff';
  const borderLight = (t['semantic/border-color/light'] as string) || 'rgba(0,0,0,0.1)';
  const borderMedium = (t['semantic/border-color/medium'] as string) || 'rgba(0,0,0,0.15)';
  const borderActive = (t['semantic/border-color/active'] as string) || '#006da2';
  const surface100 = (t['semantic/background-color/surface/100'] as string) || '#ffffff';
  const surface250 = (t['semantic/background-color/surface/250'] as string) || '#f5f5f5';
  const surface300 = (t['semantic/background-color/surface/300'] as string) || '#f0f0f0';
  const surface400 = (t['semantic/background-color/surface/400'] as string) || '#e5e5e5';

  const brS = (d['semantic/border-radius/variable/s'] as number) || 4;
  const brM = (d['semantic/border-radius/variable/m'] as number) || 6;
  const brL = (d['semantic/border-radius/variable/l'] as number) || 12;

  // Focus ring — double border: element border + gap (inner) + ring (outer)
  const focusColor = (t['semantic/box-shadow-color/state/focus'] as string) || '#006da2';
  const focusOuter = (d['semantic/box-shadow/spread-radius/focus/outer'] as number) || 3;
  const focusInner = (d['semantic/box-shadow/spread-radius/focus/inner'] as number) || 1;
  const focusRing = {
    outlineStyle: 'solid' as const,
    outlineColor: focusColor,
    outlineWidth: `${focusOuter}px`,
    outlineOffset: `${focusInner}px`,
  };

  const inputHeightMap: Record<WeaveDensity, number> = { medium: 32, high: 24, low: 40 };
  const rowHeightMap: Record<WeaveDensity, number> = { medium: 40, high: 28, low: 60 };
  const inputHeight = inputHeightMap[density];
  const rowHeight = rowHeightMap[density];

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition: 'background-color 200ms ease, color 200ms ease',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        // Global focus: double border — element border + gap (outline-offset) + ring (outline)
        // Applies to native focusable elements (buttons, inputs, links, selects…)
        '*:focus-visible': focusRing,
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: brS,
          textTransform: 'none' as const,
          fontWeight: 600,
          letterSpacing: 0,
          // Native :focus-visible is caught by global rule above
        },
        sizeSmall: { fontSize: 12, minHeight: 24, padding: `4px 10px` },
        sizeMedium: { fontSize: 14, minHeight: inputHeight, padding: `6px 14px` },
        sizeLarge: { fontSize: 14, minHeight: inputHeight + 8, padding: `10px 20px` },
        containedPrimary: {
          backgroundColor: primary,
          color: textInverse,
          '&:hover': { backgroundColor: primaryHover },
          '&:active': { backgroundColor: primaryPressed },
        },
        outlinedPrimary: {
          borderColor: primary,
          color: primary,
          '&:hover': { backgroundColor: isDark ? 'rgba(0,109,162,0.12)' : 'rgba(0,109,162,0.08)', borderColor: primaryHover },
        },
        textPrimary: {
          color: primary,
          '&:hover': { backgroundColor: isDark ? 'rgba(0,109,162,0.12)' : 'rgba(0,109,162,0.08)' },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
        },
      },
    },

    MuiTextField: { defaultProps: { size: 'small' } },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: borderMedium },
          // On focus: keep element's notchedOutline as the inner border, add outer ring via outline
          '&.Mui-focused': focusRing,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: borderActive, borderWidth: 1 },
          // Error+focus: red inner border + blue outer ring (same pattern as Figma)
          '&.Mui-focused.Mui-error': focusRing,
          '&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: (t['semantic/background-color/feedback/status/error/heavy'] as string) || '#d13f3f',
          },
        },
        input: {
          padding: density === 'high' ? '4px 8px' : density === 'low' ? '10px 12px' : '6px 10px',
          fontSize: 14,
        },
        notchedOutline: { borderColor: borderLight },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: 14 },
      },
    },

    MuiFormHelperText: {
      styleOverrides: { root: { fontSize: 11, marginTop: 4 } },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: borderMedium,
          padding: density === 'high' ? 4 : density === 'low' ? 10 : 8,
          borderRadius: brS,
          '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: primary },
          '& .MuiSvgIcon-root': { fontSize: density === 'high' ? 16 : density === 'low' ? 22 : 18 },
          // Focus ring wraps the icon, not the full touch-target root
          '&.Mui-focusVisible .MuiSvgIcon-root': { ...focusRing, borderRadius: `${brS}px` },
        },
      },
    },

    MuiRadio: {
      styleOverrides: {
        root: {
          color: borderMedium,
          padding: density === 'high' ? 4 : density === 'low' ? 10 : 8,
          '&.Mui-checked': { color: primary },
          '& .MuiSvgIcon-root': { fontSize: density === 'high' ? 16 : density === 'low' ? 22 : 18 },
          // Focus ring wraps the circular icon, not the full touch-target root
          '&.Mui-focusVisible .MuiSvgIcon-root': { ...focusRing, borderRadius: '50%' },
        },
      },
    },

    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        select: {
          paddingTop: density === 'high' ? 4 : density === 'low' ? 10 : 6,
          paddingBottom: density === 'high' ? 4 : density === 'low' ? 10 : 6,
        },
        icon: { color: textDimmed },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: rowHeight,
          fontSize: 14,
          '&.Mui-selected': {
            backgroundColor: isDark ? 'rgba(0,109,162,0.2)' : 'rgba(0,109,162,0.1)',
            '&:hover': { backgroundColor: isDark ? 'rgba(0,109,162,0.28)' : 'rgba(0,109,162,0.16)' },
          },
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : surface300 },
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: {
          width: density === 'high' ? 32 : density === 'low' ? 48 : 36,
          height: density === 'high' ? 18 : density === 'low' ? 26 : 20,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 2,
            '&.Mui-checked': {
              transform: `translateX(${density === 'high' ? 14 : density === 'low' ? 22 : 16}px)`,
              color: textInverse,
              '& + .MuiSwitch-track': { backgroundColor: primary, opacity: 1 },
            },
          },
          '& .MuiSwitch-thumb': {
            width: density === 'high' ? 14 : density === 'low' ? 22 : 16,
            height: density === 'high' ? 14 : density === 'low' ? 22 : 16,
          },
          '& .MuiSwitch-track': { borderRadius: 10, backgroundColor: borderMedium, opacity: 1 },
          // Focus ring on root (same dims as track since padding:0), pill-shaped to match track
          '&.Mui-focusVisible': { ...focusRing, borderRadius: 10 },
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: { color: primary, height: density === 'high' ? 2 : density === 'low' ? 6 : 3 },
        thumb: {
          width: density === 'high' ? 10 : density === 'low' ? 18 : 12,
          height: density === 'high' ? 10 : density === 'low' ? 18 : 12,
          '&:hover': { boxShadow: `0 0 0 8px rgba(0,109,162,0.12)` },
          // Thumb is circular — use outline on the thumb itself
          '&.Mui-focusVisible': {
            ...focusRing,
            borderRadius: '50%',
            boxShadow: 'none',
          },
        },
        rail: {
          opacity: 1,
          backgroundColor: (t['semantic/background-color/feedback/progress/track'] as string) || 'rgba(0,0,0,0.1)',
        },
      },
    },

    MuiTable: {
      styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: 11,
            color: textDimmed,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            backgroundColor: (t['semantic/background-color/data-display/column-header/default'] as string) || surface250,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: 14,
          height: rowHeight,
          padding: density === 'high' ? '0 12px' : density === 'low' ? '12px 16px' : '0 16px',
          borderBottom: `1px solid ${borderLight}`,
          color: textDefault,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : surface300 },
          '&.Mui-selected': { backgroundColor: isDark ? 'rgba(0,109,162,0.15)' : 'rgba(0,109,162,0.06)' },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${borderLight}` },
        indicator: { backgroundColor: primary, height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 400,
          fontSize: 14,
          color: textDimmed,
          borderRadius: brS,
          minHeight: density === 'high' ? 36 : density === 'low' ? 52 : 44,
          padding: density === 'high' ? '6px 12px' : density === 'low' ? '14px 16px' : '10px 16px',
          '&.Mui-selected': { color: primary, fontWeight: 600 },
          '&:hover': { color: textDefault, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          '&.Mui-focusVisible': focusRing,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          height: density === 'high' ? 20 : density === 'low' ? 32 : 24,
          fontSize: density === 'high' ? 11 : 13,
        },
        filled: {
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : surface400,
          color: textDefault,
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : surface300 },
        },
        outlined: { borderColor: borderMedium, color: textDefault },
        label: { paddingLeft: density === 'high' ? 6 : 10, paddingRight: density === 'high' ? 6 : 10 },
        deleteIcon: { fontSize: density === 'high' ? 14 : 16, color: textDimmed, '&:hover': { color: textDefault } },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: { fontSize: 10, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8 },
        dot: { width: 8, height: 8, minWidth: 8 },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          fontSize: 14,
          padding: density === 'high' ? '4px 12px' : density === 'low' ? '12px 16px' : '8px 16px',
          alignItems: 'flex-start',
        },
        standardError: {
          backgroundColor: (t['semantic/background-color/feedback/status/error/light'] as string) || '#fdeeee',
          color: (t['semantic/background-color/feedback/status/error/heavy'] as string) || '#d13f3f',
          border: `1px solid ${(t['semantic/border-color/feedback/status/error/light'] as string) || 'rgba(209,63,63,0.2)'}`,
          '& .MuiAlert-icon': { color: (t['semantic/background-color/feedback/status/error/heavy'] as string) || '#d13f3f' },
        },
        standardWarning: {
          backgroundColor: (t['semantic/background-color/feedback/status/warning/light'] as string) || '#fff9e8',
          color: isDark ? '#ffc21a' : '#8c530e',
          border: `1px solid ${(t['semantic/border-color/feedback/status/warning/light'] as string) || 'rgba(140,83,14,0.2)'}`,
          '& .MuiAlert-icon': { color: isDark ? '#ffc21a' : '#8c530e' },
        },
        standardSuccess: {
          backgroundColor: (t['semantic/background-color/feedback/status/success/light'] as string) || '#f3f7ec',
          color: (t['semantic/background-color/feedback/status/success/heavy'] as string) || '#547919',
          border: `1px solid ${(t['semantic/border-color/feedback/status/success/light'] as string) || 'rgba(84,121,25,0.2)'}`,
          '& .MuiAlert-icon': { color: (t['semantic/background-color/feedback/status/success/heavy'] as string) || '#547919' },
        },
        standardInfo: {
          backgroundColor: (t['semantic/background-color/feedback/status/info/light'] as string) || '#e6f5fb',
          color: (t['semantic/background-color/feedback/status/info/heavy'] as string) || '#006da2',
          border: `1px solid ${(t['semantic/border-color/feedback/status/info/light'] as string) || 'rgba(0,109,162,0.2)'}`,
          '& .MuiAlert-icon': { color: (t['semantic/background-color/feedback/status/info/heavy'] as string) || '#006da2' },
        },
        message: { padding: '2px 0' },
        icon: { paddingTop: 2 },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          height: density === 'high' ? 2 : density === 'low' ? 8 : 4,
          backgroundColor: (t['semantic/background-color/feedback/progress/track'] as string) || 'rgba(0,0,0,0.08)',
        },
        bar: {
          borderRadius: brS,
          backgroundColor: (t['semantic/background-color/feedback/progress/value/dark'] as string) || primary,
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: { root: { color: primary } },
    },

    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: isDark ? '#1a1a1a' : '#363636',
          color: '#ffffff',
          fontSize: 12,
          lineHeight: '16px',
          padding: '4px 8px',
          borderRadius: brS,
          maxWidth: 240,
        },
        arrow: { color: isDark ? '#1a1a1a' : '#363636' },
      },
    },

    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${borderLight}`,
          borderRadius: `${brS}px !important`,
          marginBottom: 4,
          '&::before': { display: 'none' },
          '&.Mui-expanded': { marginBottom: 4 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: density === 'high' ? 36 : density === 'low' ? 52 : 44,
          padding: `0 ${density === 'high' ? 12 : 16}px`,
          '& .MuiAccordionSummary-content': { margin: '8px 0', fontWeight: 600 },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: density === 'high' ? '4px 12px 8px' : density === 'low' ? '12px 16px 16px' : '8px 16px 12px',
          borderTop: `1px solid ${borderLight}`,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: brL, backgroundColor: surface100 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: 18,
          fontWeight: 600,
          padding: density === 'high' ? '12px 16px' : '16px 24px',
          borderBottom: `1px solid ${borderLight}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: density === 'high' ? '8px 16px' : '16px 24px', fontSize: 14 },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: density === 'high' ? '8px 16px 12px' : '12px 24px 20px',
          gap: 8,
          borderTop: `1px solid ${borderLight}`,
        },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: borderLight } },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? '#1f2937' : primary,
          color: '#ffffff',
          boxShadow: `0 1px 3px rgba(0,0,0,0.15)`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: isDark ? '#1a1f2b' : surface100,
          borderRight: `1px solid ${borderLight}`,
        },
      },
    },

    MuiBreadcrumbs: {
      styleOverrides: {
        root: { fontSize: 14 },
        separator: { color: textDimmed },
      },
    },

    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          minWidth: density === 'high' ? 24 : density === 'low' ? 40 : 32,
          height: density === 'high' ? 24 : density === 'low' ? 40 : 32,
          fontSize: 14,
          color: textDefault,
          '&.Mui-selected': {
            backgroundColor: primary,
            color: textInverse,
            '&:hover': { backgroundColor: primaryHover },
          },
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : surface300 },
          '&.Mui-focusVisible': focusRing,
        },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          borderRadius: brS,
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: brM,
          boxShadow: `0 4px 16px rgba(0,0,0,0.15)`,
          backgroundColor: surface100,
          border: `1px solid ${borderLight}`,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: brM,
          boxShadow: `0 4px 16px rgba(0,0,0,0.15)`,
          backgroundColor: surface100,
          border: `1px solid ${borderLight}`,
          minWidth: 120,
        },
        list: { padding: '4px 0' },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: brS,
          '&.Mui-selected': {
            backgroundColor: isDark ? 'rgba(0,109,162,0.2)' : 'rgba(0,109,162,0.1)',
            color: primary,
            '&:hover': { backgroundColor: isDark ? 'rgba(0,109,162,0.28)' : 'rgba(0,109,162,0.16)' },
          },
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : surface300 },
          '&.Mui-focusVisible': focusRing,
        },
      },
    },

    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: brM,
          border: `1px solid ${borderLight}`,
          boxShadow: 'none',
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: {
        root: { backgroundColor: '#363636', color: '#ffffff', borderRadius: brS, fontSize: 14 },
      },
    },

    MuiDataGrid: {
      styleOverrides: {
        root: {
          borderColor: borderLight,
          fontSize: 14,
          '--DataGrid-rowBorderColor': borderLight,
        },
        columnHeader: {
          backgroundColor: (t['semantic/background-color/data-display/column-header/default'] as string) || surface250,
          fontWeight: 600,
          fontSize: 11,
          color: textDimmed,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        },
        row: {
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : surface300 },
          '&.Mui-selected': {
            backgroundColor: isDark ? 'rgba(0,109,162,0.15)' : 'rgba(0,109,162,0.06)',
            '&:hover': { backgroundColor: isDark ? 'rgba(0,109,162,0.22)' : 'rgba(0,109,162,0.1)' },
          },
        },
        cell: {
          borderColor: borderLight,
          '&:focus, &:focus-within': focusRing,
        },
        columnHeaderTitle: {
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase' as const,
        },
      },
    } as any,

    MuiPickersDay: {
      styleOverrides: {
        root: {
          fontSize: 14,
          borderRadius: brS,
          '&.Mui-selected': {
            backgroundColor: primary,
            color: textInverse,
            '&:hover': { backgroundColor: primaryHover },
          },
          '&:focus.Mui-selected': {
            backgroundColor: primary,
          },
          '&.Mui-focusVisible': focusRing,
        },
      },
    } as any,

    MuiDateCalendar: {
      styleOverrides: {
        root: {
          color: textDefault,
        },
      },
    } as any,
  };
}
