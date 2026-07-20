"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : "system";

  return (
    <Sonner
      closeButton
      position="bottom-right"
      richColors
      theme={theme}
      {...props}
    />
  );
}

export { Toaster };
