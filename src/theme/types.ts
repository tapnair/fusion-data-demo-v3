export type WeaveColorScheme = 'light-gray' | 'dark-gray' | 'dark-blue';
export type WeaveDensity = 'medium' | 'high' | 'low';

export interface WeaveThemeOptions {
  colorScheme: WeaveColorScheme;
  density: WeaveDensity;
}

declare module '@mui/material/styles' {
  interface Theme {
    colorScheme: WeaveColorScheme;
    density: WeaveDensity;
  }
  interface ThemeOptions {
    colorScheme?: WeaveColorScheme;
    density?: WeaveDensity;
  }
}
