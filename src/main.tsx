import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { InstallGate } from './screens/InstallGate'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Inside the boundary: a crash in the gate must not be a white screen either. */}
    <ErrorBoundary>
      <InstallGate>
        <App />
      </InstallGate>
    </ErrorBoundary>
  </StrictMode>,
)
