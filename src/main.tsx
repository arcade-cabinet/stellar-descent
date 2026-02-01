import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './css/main.css';
import './css/colorblind.css';

// Platform detection - initialize physical keyboard and gamepad detection early
import { initGamepadDetection, initPhysicalKeyboardDetection } from './game/utils/PlatformDetector';

// Initialize the application
function initApp() {
  // Initialize physical keyboard detection for mobile devices
  initPhysicalKeyboardDetection();

  // Initialize gamepad detection to enable controller support
  initGamepadDetection();

  // Render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
