import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext({ theme: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('resa_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('resa_theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function ThemeToggle() {
  const { toggle } = useTheme();
  return (
    <div
      className="v3-theme-toggle"
      onClick={toggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && toggle()}
    >
      <span>☀</span>
      <div className="v3-toggle-track">
        <div className="v3-toggle-knob" />
      </div>
      <span>🌙</span>
    </div>
  );
}
