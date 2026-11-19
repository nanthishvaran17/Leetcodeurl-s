import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setSystemTheme: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('theme') as Theme;
    const userSet = localStorage.getItem('theme_user_set');
    if (userSet && (saved === 'dark' || saved === 'light')) {
      return saved;
    }
    // If not manually locked by user, check device system dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return saved === 'light' ? 'light' : 'dark';
  } catch (_) {
    return 'dark';
  }
}

function getInitialAccentColor(): string {
  if (typeof window === 'undefined') return 'indigo';
  try {
    return localStorage.getItem('nec_accent_color') || 'indigo';
  } catch (_) {
    return 'indigo';
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [accentColor, setAccentColor] = useState<string>(getInitialAccentColor);

  // Synchronous DOM applier for instant zero-delay theme & accent switching
  const applyThemeToDOM = (newTheme: Theme) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const body = window.document.body;

    if (newTheme === 'dark') {
      root.classList.add('dark');
      if (body) body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      if (body) body.classList.remove('dark');
    }

    try {
      const themeColor = newTheme === 'dark' ? '#060813' : '#f8fafc';
      const metaTags = document.querySelectorAll('meta[name="theme-color"]');
      if (metaTags.length > 0) {
        metaTags.forEach(tag => tag.setAttribute('content', themeColor));
      }
    } catch (_) {}
  };

  const applyAccentToDOM = (color: string) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    root.setAttribute('data-accent', color);
  };

  // Sync DOM classes, accent attributes, and Android system theme-color
  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem('theme', theme);

    if (accentColor) {
      applyAccentToDOM(accentColor);
      localStorage.setItem('nec_accent_color', accentColor);
    }
  }, [theme, accentColor]);

  // Listen to mobile system dark mode preference changes in real-time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Automatically adapt to phone system settings if user hasn't locked theme
      const isUserLocked = localStorage.getItem('theme_user_set');
      if (!isUserLocked) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleSystemThemeChange);
      return () => (mediaQuery as any).removeListener(handleSystemThemeChange);
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDOM(next);
      localStorage.setItem('theme', next);
      localStorage.setItem('theme_user_set', 'true');
      return next;
    });
  };

  const handleSetTheme = (newTheme: Theme) => {
    applyThemeToDOM(newTheme);
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('theme_user_set', 'true');
  };

  const handleSetSystemTheme = () => {
    localStorage.removeItem('theme_user_set');
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const sysTheme = isDark ? 'dark' : 'light';
    applyThemeToDOM(sysTheme);
    setTheme(sysTheme);
    localStorage.setItem('theme', sysTheme);
  };

  const handleSetAccentColor = (color: string) => {
    applyAccentToDOM(color);
    setAccentColor(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nec_accent_color', color);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: handleSetTheme, setSystemTheme: handleSetSystemTheme, accentColor, setAccentColor: handleSetAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
