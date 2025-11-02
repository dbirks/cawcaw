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

  const updateThemePreference = useCallback(
    async (preference: ThemePreference) => {
      setThemePreference(preference);

      // Save to localStorage first (synchronous, enables instant theme on reload)
      try {
        localStorage.setItem('theme_preference', preference);
      } catch (error) {
        console.error('Failed to save theme preference to localStorage:', error);
      }

      // Also save to secure storage for mobile
      try {
        await SecureStoragePlugin.set({ key: 'theme_preference', value: preference });
      } catch (error) {
        console.error('Failed to save theme preference to secure storage:', error);
      }

      // Apply the theme
      let themeToApply: Theme;
      if (preference === 'system') {
        themeToApply = getSystemTheme();
      } else {
        themeToApply = preference;
      }
      applyTheme(themeToApply);
    },
    [applyTheme, getSystemTheme]
  );

  // Initialize theme on mount
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Try localStorage first (synchronous, already applied by inline script)
        let savedPreference: ThemePreference | null = null;
        try {
          const localStorageValue = localStorage.getItem('theme_preference');
          if (localStorageValue) {
            savedPreference = localStorageValue as ThemePreference;
          }
        } catch (error) {
          console.error('Failed to read from localStorage:', error);
        }

        // Fallback to secure storage if localStorage not available
        if (!savedPreference) {
          const themeResult = await SecureStoragePlugin.get({ key: 'theme_preference' });
          savedPreference = (themeResult?.value as ThemePreference) || null;
        }

        // Use system as default if no preference found
        const preference = savedPreference || 'system';
        setThemePreference(preference);

        // Theme should already be applied by inline script in index.html,
        // but we apply it again to ensure consistency
        let initialTheme: Theme;
        if (preference === 'system') {
          initialTheme = getSystemTheme();
        } else {
          initialTheme = preference;
        }
        applyTheme(initialTheme);

        // Sync localStorage with secure storage if needed
        if (savedPreference && !localStorage.getItem('theme_preference')) {
          try {
            localStorage.setItem('theme_preference', savedPreference);
          } catch (error) {
            console.error('Failed to sync theme to localStorage:', error);
          }
        }
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
