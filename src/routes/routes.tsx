import { App } from "@/App"
import react from "react";
import { Login } from "@/pages/login/page"
import { SignUp } from "@/pages/sign-up/page"
import { Outlet, createBrowserRouter } from "react-router"
import { Navigate } from "react-router";
import { Home } from "@/pages/home/page";
import { Rooms } from "@/pages/rooms/page";
import VideoAnalysisPage from "@/pages/video-analysis/page";
import ComparisonPage from "@/pages/comparison/page";
import RoomVideoManagerPage from '@/pages/rooms/RoomVideoManagerPage';
import { ProtectedRoute } from "@/components/ProtectedRoute"

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App children={<Outlet />} />,
    children: [
      { path: "login", element: <Login /> },
      { path: "signup", element: <SignUp /> },

      // ✅ Protected routes (including Home)
      {
        element: <ProtectedRoute />,
        children: [
          { path: "", element: <Home /> },
          { path: "homes/:homeId", element: <Rooms /> },
          { path: "homes/:homeId/rooms/:roomId", element: <RoomVideoManagerPage /> },
          { path: "video-analysis", element: <VideoAnalysisPage /> },
          { path: "comparison", element: <ComparisonPage /> },
        ],
      },
    ]
  }
])