import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/base.css';
import './styles/layout.css';
import './styles/mission.css';
import './styles/instruments.css';
import './styles/catalogs.css';
import './styles/selection-flow.css';
import './styles/clarity.css';
import './styles/history.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
