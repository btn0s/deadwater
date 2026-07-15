import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './editor.css'
import { EditorApp } from './EditorApp'
import { BuildEditorApp } from './BuildEditorApp'

const useClassicEditor = new URLSearchParams(window.location.search).has('classic')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useClassicEditor ? <EditorApp /> : <BuildEditorApp />}
  </StrictMode>,
)
