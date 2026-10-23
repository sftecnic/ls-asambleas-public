import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {canonicalAppUrl} from './domain/authRouting';
import './styles/app.css';
import './styles/accessibility.css';
import './styles/visual-system.css';

const canonical = canonicalAppUrl(import.meta.env.VITE_FIREBASE_PROJECT_ID, location.href, import.meta.env.PROD);
if (canonical) {
  location.replace(canonical);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
}
