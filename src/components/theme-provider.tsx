"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "aclplus-theme";

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Sync React state to whatever the pre-hydration script already applied.
  // The inline script in layout.tsx set the document class before paint; this
  // effect just catches React up so the toggle UI renders the right active state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? (window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null)
      : null) ?? "system";
    const resolvedTheme = resolveTheme(saved);
    setPreferenceState(saved);
    setResolved(resolvedTheme);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Follow system changes when preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const next = media.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    const next = resolveTheme(value);
    setPreferenceState(value);
    setResolved(next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
