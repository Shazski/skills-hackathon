import { App } from "@/App"
import react from "react";
import { Login } from "@/pages/login/page"
import { Outlet, createBrowserRouter } from "react-router"
import { Navigate } from "react-router";

const ProtectedRoute = ({ children }: { children: react.PropsWithChildren }) => {
  const isAuthenticated = !!false
  return isAuthenticated ? children : <Navigate to="/login" />;
}
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App children={<Outlet />} />,
    children: [{
      path: 'login',
      element: <Login />
    }]
  },
])