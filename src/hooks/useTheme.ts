import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Theme } from "../types/models";

export function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    if (!theme) return;

    const html = document.documentElement;

    const applyDark = (isDark: boolean) => {
      if (isDark) {
        html.classList.add("dark");
        html.setAttribute("data-theme", "dark");
      } else {
        html.classList.remove("dark");
        html.setAttribute("data-theme", "light");
      }
    };

    const themeStr = String(theme);

    if (themeStr === "Dark") {
      applyDark(true);
      return () => {
        html.classList.remove("dark");
        html.removeAttribute("data-theme");
      };
    }
    if (themeStr === "Light") {
      applyDark(false);
      return () => html.removeAttribute("data-theme");
    }

    // System mode — use Tauri's native theme detection
    let unlisten: (() => void) | null = null;

    const win = getCurrentWindow();

    // Apply current system theme
    win.theme().then((sysTheme) => {
      applyDark(sysTheme === "dark");
    });

    // Listen for system theme changes
    win.onThemeChanged(({ payload: sysTheme }) => {
      applyDark(sysTheme === "dark");
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
      html.classList.remove("dark");
      html.removeAttribute("data-theme");
    };
  }, [theme]);
}
