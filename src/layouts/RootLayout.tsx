import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"

export const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      {children}
    </ThemeProvider>
  )
}
