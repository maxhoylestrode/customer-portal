import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

// The theme lives on <html data-theme>; index.html sets it before first paint.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111113' : '#fbfbfc');
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* private mode etc. — the theme just won't persist */
    }
  }, [theme]);

  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
