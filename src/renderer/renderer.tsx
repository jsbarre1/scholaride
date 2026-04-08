import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext';
import './styles/index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <ClassProvider>
          <App />
        </ClassProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

