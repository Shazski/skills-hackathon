import { NavBar } from "@/components/NavBar"
import type { ReactNode } from "react"

export const App = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <NavBar />
      <div className="flex justify-center items-center min-h-screen">
        {children}
      </div>
    </>
  )
}
