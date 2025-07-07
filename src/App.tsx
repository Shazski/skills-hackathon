import { NavBar } from "@/components/NavBar"
import { ThemeProvider } from "@/components/theme-provicer";
import type { ReactNode } from "react"
import { useLocation, useNavigationType } from "react-router"
import { Loader } from "@/components/ui/Loader";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

// Loader context
const LoaderContext = createContext({ show: () => { }, hide: () => { } });
export const useLoader = () => useContext(LoaderContext);

export const App = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const [loading, setLoading] = useState(false);

  // Show loader on navigation
  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 700); // fallback in case no API call
    return () => clearTimeout(timeout);
  }, [location.pathname, navigationType]);

  // Loader context handlers for API calls
  const show = useCallback(() => setLoading(true), []);
  const hide = useCallback(() => setLoading(false), []);

  return (
    <LoaderContext.Provider value={{ show, hide }}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <div className="h-screen">
          <NavBar />
          {loading && <Loader />}
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
    </LoaderContext.Provider>
  )
}
