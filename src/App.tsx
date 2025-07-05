import { NavBar } from "@/components/NavBar"
import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"
import { useLocation } from "react-router"

export const App = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="h-screen">
        <NavBar />
        <div className="pt-20 h-full overflow-y-auto scrollbar-hide">
          {isAuthPage ? (
            <div className="flex justify-center items-center min-h-[calc(100vh-5rem)] w-full">
              {children}
            </div>
          ) : (
            <div className="min-h-[calc(100vh-5rem)] w-full">
              {children}
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
