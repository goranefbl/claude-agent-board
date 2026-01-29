import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import { applyThemeColor, COLOR_NAMES, type ThemeColorName } from '../theme/colors';

export function useTheme() {
  const [color, setColorState] = useState<ThemeColorName>('amber');

  useEffect(() => {
    // Apply default immediately so CSS vars exist before first paint
    applyThemeColor('amber');

    api.get<Record<string, any>>('/settings').then((data) => {
      const saved = data.theme_color?.value as string | undefined;
      if (saved && COLOR_NAMES.includes(saved as ThemeColorName)) {
        const name = saved as ThemeColorName;
        setColorState(name);
        applyThemeColor(name);
      }
    }).catch(() => {});
  }, []);

  const setColor = useCallback(async (name: ThemeColorName) => {
    setColorState(name);
    applyThemeColor(name);
    try {
      await api.put('/settings/theme_color', { value: name });
    } catch {
      // ignore save errors — color is already applied locally
    }
  }, []);

  return { color, setColor, colorNames: COLOR_NAMES };
}
