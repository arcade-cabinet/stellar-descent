import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './css/main.css';
import './css/colorblind.css';

// Import jeep-sqlite web component for Capacitor SQLite web support
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

// Register jeep-sqlite custom elements for web platform SQLite support
jeepSqlite(window);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
