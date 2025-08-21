import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { useCallback, useEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';

export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [currentTheme, setCurrentTheme] = useState<Theme>('light');

  const getSystemTheme = useCallback((): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }, []);

  const applyTheme = useCallback((theme: Theme) => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    setCurrentTheme(theme);
  }, []);

  const updateThemePreference = useCallback(async (preference: ThemePreference) => {
    setThemePreference(preference);
    
    // Save preference to secure storage
    try {
      await SecureStoragePlugin.set({ key: 'theme_preference', value: preference });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }

    // Apply the theme
    let themeToApply: Theme;
    if (preference === 'system') {
      themeToApply = getSystemTheme();
    } else {
      themeToApply = preference;
    }
    applyTheme(themeToApply);
  }, [applyTheme, getSystemTheme]);

  // Initialize theme on mount
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Load theme preference
        const themeResult = await SecureStoragePlugin.get({ key: 'theme_preference' });
        const savedPreference = (themeResult?.value as ThemePreference) || 'system';
        setThemePreference(savedPreference);
        
        // Apply initial theme
        let initialTheme: Theme;
        if (savedPreference === 'system') {
          initialTheme = getSystemTheme();
        } else {
          initialTheme = savedPreference;
        }
        applyTheme(initialTheme);
      } catch (error) {
        console.error('Failed to initialize theme:', error);
        // Fallback to system theme
        applyTheme(getSystemTheme());
      }
    };

    initializeTheme();
  }, [applyTheme, getSystemTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (themePreference === 'system') {
        applyTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [themePreference, applyTheme, getSystemTheme]);

  return {
    themePreference,
    currentTheme,
    updateThemePreference,
  };
}