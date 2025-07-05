import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"

export const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <NavBar />
      <div className="pt-20">
        {children}
      </div>
    </ThemeProvider>
  )
}
