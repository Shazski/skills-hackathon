import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { router } from './routes/routes.tsx';
import { RouterProvider } from 'react-router';
import { RootLayout } from './layouts/RootLayout';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
