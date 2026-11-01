import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/theme';
import { ToastProvider } from './context/toast';
import { AuthProvider } from './context/auth';
import { LiveProvider } from './context/live';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <LiveProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </LiveProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
