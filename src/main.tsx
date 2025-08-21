import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Initialize StatusBar on mobile platforms
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Default }).catch(console.error);
  StatusBar.setOverlaysWebView({ overlay: false }).catch(console.error);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
