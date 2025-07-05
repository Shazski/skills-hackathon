import { NavBar } from "@/components/NavBar"
import type { ReactNode } from "react"

export const App = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <div className="flex justify-center items-center h-[calc(100vh-5rem)] w-full">
        {children}
      </div>
    </>
  )
}
