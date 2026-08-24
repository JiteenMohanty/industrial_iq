"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

/**
 * State starts as "light" unconditionally — matching what the server always renders, since it has
 * no access to localStorage/the client's `.dark` class. Reading the real value here instead (e.g.
 * from `document`) would make the client's first render disagree with the server's, and because
 * `ThemeToggle`'s icon depends on `theme`, that disagreement is a genuine hydration mismatch, not
 * just an unused branch. `useLayoutEffect` (not `useEffect`) syncs to the actual class — already
 * set correctly by the blocking FOUC script in layout.tsx's <head> — synchronously after mount but
 * before the browser paints, so there is no visible flash even though state technically updates
 * once after the initial render.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useLayoutEffect(() => {
    const actual: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(actual);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("dealerpulse-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

/** Client chart components use this to pick the light/dark member of each COLOR pair in theme.ts. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
