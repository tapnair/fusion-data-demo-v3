import { createTheme, Theme } from '@mui/material/styles';
import type { WeaveThemeOptions } from './types';
import { createPalette } from './base/palette';
import { createTypography } from './base/typography';
import { createSpacing } from './base/spacing';
import { createShape } from './base/shape';
import { createShadows } from './base/shadows';
import { createComponentOverrides } from './overrides';

export function createWeaveTheme({ colorScheme, density }: WeaveThemeOptions): Theme {
  return createTheme({
    palette: createPalette(colorScheme),
    typography: createTypography(density),
    spacing: createSpacing(density),
    shape: createShape(density),
    shadows: createShadows(colorScheme),
    components: createComponentOverrides(colorScheme, density),
    colorScheme,
    density,
  } as any);
}
