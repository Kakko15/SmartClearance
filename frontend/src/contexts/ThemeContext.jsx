import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreference] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const [prevThemePref, setPrevThemePref] = useState(themePreference);
  if (themePreference !== prevThemePref) {
    setPrevThemePref(themePreference);
    let activeDark = false;
    if (themePreference === "dark") activeDark = true;
    else if (themePreference === "light") activeDark = false;
    else if (typeof window !== "undefined")
      activeDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    setIsDarkMode(activeDark);
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const watcher = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e) => {
      if (themePreference === "system") {
        setIsDarkMode(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    watcher.addEventListener("change", listener);
    return () => watcher.removeEventListener("change", listener);
  }, [themePreference]);

  const toggleTheme = (newPref) => {
    if (typeof newPref === "string") {
      setThemePreference(newPref);
      localStorage.setItem("theme", newPref);
    } else {
      const p = isDarkMode ? "light" : "dark";
      setThemePreference(p);
      localStorage.setItem("theme", p);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
