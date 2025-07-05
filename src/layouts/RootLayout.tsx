import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"

export const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="h-screen">
        <NavBar />
        <div className="pt-20 h-full">
          {children}
        </div>
      </div>
    </ThemeProvider>
  )
}
