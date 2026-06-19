import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";

import { storage } from "@/src/utils/storage";

import { Palette, palettes, ThemeMode } from "./tokens";

interface ThemeCtx {
  mode: ThemeMode;
  colors: Palette;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "gully.theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(STORAGE_KEY, "");
      if (stored === "dark" || stored === "light") {
        setModeState(stored);
      } else {
        // Dark mode is the explicit default per product spec; user can toggle.
        setModeState("dark");
      }
      setLoaded(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      storage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({ mode, colors: palettes[mode], toggle, setMode }),
    [mode, toggle, setMode],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
