import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl, setClientId } from '@workspace/api-client-react';

import './index.css';

const apiUrl = import.meta.env.VITE_API_URL?.trim();
if (apiUrl) setBaseUrl(apiUrl);

const clientIdStorageKey = 'minecraft-console:client-id';
let clientId = window.localStorage.getItem(clientIdStorageKey);
if (!clientId) {
  clientId = crypto.randomUUID();
  window.localStorage.setItem(clientIdStorageKey, clientId);
}
setClientId(clientId);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
