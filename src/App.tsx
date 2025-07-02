import { NavBar } from "@/components/NavBar"
import type { ReactNode } from "react"

export const App = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <div className="flex justify-center items-center min-h-[85vh]">
        {children}
      </div>
    </>
  )
}
