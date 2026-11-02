"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "cashow-theme";
export const THEME_CHANGE_EVENT = "cashow-theme-change";

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function setTheme(nextTheme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage quota or security errors
  }
  applyTheme(nextTheme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: nextTheme }));
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleSync = () => {
    applyTheme(getStoredTheme());
    callback();
  };

  const handleMediaChange = () => {
    if (getStoredTheme() === "system") {
      applyTheme("system");
      callback();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleSync);
  window.addEventListener("storage", handleSync);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", handleMediaChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleSync);
    window.removeEventListener("storage", handleSync);
    media.removeEventListener("change", handleMediaChange);
  };
}

export function useTheme() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ensure the DOM has the exact class corresponding to stored preference
    applyTheme(getStoredTheme());
  }, []);

  const theme = useSyncExternalStore(subscribe, getStoredTheme, () => "system");

  return {
    theme,
    setTheme,
    mounted,
  };
}
