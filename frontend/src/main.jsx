import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PrivacyProvider } from './privacy'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
