// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router"
import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

export function ProtectedRoute() {
  const [checking, setChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Current user:", auth.currentUser)
      console.log("user:", user)
      setIsAuthenticated(!!user)
      setChecking(false)
    })

    return () => unsubscribe()
  }, [])

  if (checking) {
    return '';
    // return <div className="text-center py-10 text-gray-500">Checking authentication...</div>
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
