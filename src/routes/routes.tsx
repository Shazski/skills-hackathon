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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App children={<Outlet />} />,
    children: [
      {
        path: 'login',
        element: <Login />
      },
      {
        path: 'signup',
        element: <SignUp />
      },
      {
        path: 'home',
        element: <Home />
      },
      {
        path: 'rooms/:homeId',
        element: <Rooms />
      },
      {
        path: 'video-analysis',
        element: <VideoAnalysisPage />
      },
      {
        path: 'comparison',
        element: <ComparisonPage />
      },
    ]
  }
])