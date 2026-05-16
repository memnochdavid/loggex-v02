import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/csrfInterceptor'
import './index.css'
import './styles/toast.css'
import './i18n/i18n'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    <App />
  // </StrictMode>,
)
