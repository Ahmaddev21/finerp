import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// When a new deployment is pushed, Vite generates new chunk hashes.
// Any tab that was open before the deploy will try to fetch old chunk URLs
// that no longer exist → silent 404 → infinite loading.
// This handler catches that exact failure and does a one-time reload
// so the browser fetches the fresh index.html with new chunk URLs.
window.addEventListener('vite:preloadError', () => {
  const key = 'finerp_chunk_reload_at';
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last > 15_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
