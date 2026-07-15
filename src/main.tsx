import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const query = new URLSearchParams(window.location.search)

if (query.has('editor')) {
  const editorUrl = new URL('/editor.html', window.location.href)
  editorUrl.search = window.location.search
  window.location.replace(editorUrl)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
