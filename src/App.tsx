import { ThemeProvider } from './components/theme-provicer';
import { ModeToggle } from './components/mode-toggle';
import { NavBar } from './components/NavBar';

export const App = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <div className='mb-4 p-4 mt-4 min-h-screen'>
          <div className='flex justify-between'>
            <NavBar />
            <ModeToggle />
          </div>
          {children}
        </div>
      </ThemeProvider>
    </>
  )
}
