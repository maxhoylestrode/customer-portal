import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

// A deploy's new service worker takes over straight away (skipWaiting +
// clients.claim). If that happens while this page is still starting up, reload
// so it isn't left running the old build. Later on, leave it alone rather than
// throw away whatever someone is typing; the next open gets the new version.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || performance.now() > 30_000) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
