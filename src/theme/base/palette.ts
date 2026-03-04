import { PaletteOptions } from '@mui/material/styles';
import type { WeaveColorScheme } from '../types';
import { themeTokens } from '../tokens/theme';

export function createPalette(scheme: WeaveColorScheme): PaletteOptions {
  const t = themeTokens[scheme];
  const isDark = scheme !== 'light-gray';
  return {
    mode: isDark ? 'dark' : 'light',
    primary: {
      main: (t['semantic/background-color/input/primary/default'] as string) || '#006da2',
      dark: (t['semantic/background-color/input/primary/hover'] as string) || '#006698',
      contrastText: '#ffffff',
    },
    error: { main: (t['semantic/background-color/feedback/status/error/heavy'] as string) || '#d13f3f' },
    warning: { main: (t['semantic/background-color/feedback/status/warning/heavy'] as string) || '#ffc21a' },
    success: { main: (t['semantic/background-color/feedback/status/success/heavy'] as string) || '#547919' },
    info: { main: (t['semantic/background-color/feedback/status/info/heavy'] as string) || '#006da2' },
    text: {
      primary: (t['semantic/text-color/default'] as string) || '#363636',
      secondary: (t['semantic/text-color/dimmed'] as string) || 'rgba(54,54,54,0.55)',
      disabled: (t['semantic/text-color/dimmed'] as string) || 'rgba(54,54,54,0.55)',
    },
    background: {
      default: (t['semantic/background-color/surface/250'] as string) || '#f5f5f5',
      paper: (t['semantic/background-color/surface/100'] as string) || '#ffffff',
    },
    divider: (t['semantic/border-color/light'] as string) || 'rgba(0,0,0,0.1)',
  };
}
