import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './css/main.css';
import './css/colorblind.css';

// Platform detection - initialize physical keyboard and gamepad detection early
import { initGamepadDetection, initPhysicalKeyboardDetection } from './game/utils/PlatformDetector';

// Database initialization - MUST happen before React mounts components that use stores
import { saveSystem } from './game/persistence';
import { getLogger } from './game/core/Logger';
import { initAchievements } from './game/achievements';
import { useDifficultyStore } from './game/difficulty/useDifficultyStore';

const log = getLogger('Main');

// Initialize the application
async function initApp() {
  // Initialize physical keyboard detection for mobile devices
  initPhysicalKeyboardDetection();

  // Initialize gamepad detection to enable controller support
  initGamepadDetection();

  // CRITICAL: Initialize database before React renders
  // This ensures SQLite is ready before any Zustand stores try to hydrate
  try {
    log.info('Initializing database...');
    await saveSystem.initialize();
    log.info('Database initialized successfully');

    // Initialize achievements AFTER database is ready
    log.info('Initializing achievements...');
    await initAchievements();
    log.info('Achievements initialized successfully');

    // Initialize difficulty store AFTER database is ready
    log.info('Initializing difficulty store...');
    await useDifficultyStore.getState().initialize();
    log.info('Difficulty store initialized successfully');
  } catch (error) {
    log.error('Failed to initialize database or achievements:', error);
    // Continue anyway - stores will use defaults if database fails
  }

  // Render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
