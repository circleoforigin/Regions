import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RegionsStateProvider } from './state/RegionsStateProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegionsStateProvider>
      <App />
    </RegionsStateProvider>
  </StrictMode>,
)
