import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"

export const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div>
        <NavBar />
      </div>
      <div className="mt-6">
        {children}
      </div>
    </ThemeProvider>
  )
}
