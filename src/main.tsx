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

// Register jeep-sqlite custom elements for web platform SQLite support
jeepSqlite(window);

// Initialize physical keyboard detection for mobile devices
// This allows us to show keyboard settings only when a Bluetooth/USB keyboard is connected
initPhysicalKeyboardDetection();

// Initialize gamepad detection to enable controller support
initGamepadDetection();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
