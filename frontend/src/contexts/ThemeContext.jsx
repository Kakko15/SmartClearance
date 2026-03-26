import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

function resolveIsDark(pref) {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreference] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  const [isDarkMode, setIsDarkMode] = useState(() =>
    resolveIsDark(localStorage.getItem("theme") || "system"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const watcher = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e) => {
      if (themePreference === "system") {
        setIsDarkMode(e.matches);
      }
    };
    watcher.addEventListener("change", listener);
    return () => watcher.removeEventListener("change", listener);
  }, [themePreference]);

  const toggleTheme = (newPref) => {
    const pref =
      typeof newPref === "string" ? newPref : isDarkMode ? "light" : "dark";
    setThemePreference(pref);
    localStorage.setItem("theme", pref);
    setIsDarkMode(resolveIsDark(pref));
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
