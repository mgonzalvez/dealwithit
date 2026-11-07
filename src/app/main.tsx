/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import '../styles/styles.css';
import '../styles/workshop.css';
import '../styles/backdesigner.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}
createRoot(root).render(<App />);

// PWA: register the service worker in production builds so the app shell
// works offline after the first visit. User images stay in IndexedDB.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('Service worker registration failed:', error));
  });
}
