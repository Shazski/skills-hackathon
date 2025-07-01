import { App } from "@/App"
import { Login } from "@/pages/login/page"
import { Outlet, createBrowserRouter } from "react-router"

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App children={<Outlet />} />
  },
  {
    path: '/login',
    element: <Login />
  }
])