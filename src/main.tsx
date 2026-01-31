import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './css/main.css';
import './css/colorblind.css';

// Import jeep-sqlite web component for Capacitor SQLite web support
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

// Platform detection - initialize physical keyboard and gamepad detection early
import {
  initPhysicalKeyboardDetection,
  initGamepadDetection,
} from './game/utils/PlatformDetector';

// Initialize the application after jeep-sqlite is ready
async function initApp() {
  // Register jeep-sqlite custom elements and wait for them to be defined
  await jeepSqlite(window);

  // Create the jeep-sqlite element if it doesn't exist (Vite may strip it from index.html)
  let jeepEl = document.querySelector('jeep-sqlite');
  if (!jeepEl) {
    jeepEl = document.createElement('jeep-sqlite');
    jeepEl.setAttribute('autoSave', 'true');
    document.body.insertBefore(jeepEl, document.body.firstChild);
  }

  // Wait for the custom element to be defined
  await customElements.whenDefined('jeep-sqlite');

  // Wait for the jeep-sqlite Stencil component to be fully ready
  if ('componentOnReady' in jeepEl) {
    await (jeepEl as any).componentOnReady();
  }

  // Initialize physical keyboard detection for mobile devices
  initPhysicalKeyboardDetection();

  // Initialize gamepad detection to enable controller support
  initGamepadDetection();

  // Now render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
