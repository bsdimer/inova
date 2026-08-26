import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeColors } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightTheme,
  isDark: false,
  mode: 'system',
  setMode: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  // TODO(M5): persist the preference (secure-store/async-storage) with settings.
  const [mode, setMode] = useState<ThemeMode>('system');

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
    return {
      colors: isDark ? darkTheme : lightTheme,
      isDark,
      mode,
      setMode,
    };
  }, [scheme, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
