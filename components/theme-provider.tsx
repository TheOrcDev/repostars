"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "d") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const newTheme = resolvedTheme === "dark" ? "light" : "dark";

      if (typeof document.startViewTransition !== "function") {
        setTheme(newTheme);
        return;
      }

      const transition = document.startViewTransition(() => {
        setTheme(newTheme);
      });

      // A view transition rejects its promises when aborted (e.g. a rapid
      // second press); swallow it to avoid an unhandled rejection.
      transition.ready.catch(() => undefined);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resolvedTheme, setTheme]);

  return null;
}
