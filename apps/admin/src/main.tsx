import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { IconContext } from '@phosphor-icons/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from './lib/theme';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient();

// Before the first paint, so the app never flashes the light theme at night.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The mock-ups are drawn in Phosphor Light; set the weight once here. */}
    <IconContext.Provider value={{ weight: 'light' }}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </IconContext.Provider>
  </StrictMode>,
);
