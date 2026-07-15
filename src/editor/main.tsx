import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './editor.css'
import { EditorApp } from './EditorApp'
import { BuildEditorApp } from './BuildEditorApp'

const query = new URLSearchParams(window.location.search)
const editorEnabled = import.meta.env.DEV || query.has('editor')
const useClassicEditor = query.has('classic')

if (!editorEnabled) {
  window.location.replace('/not-found')
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {useClassicEditor ? <EditorApp /> : <BuildEditorApp />}
    </StrictMode>,
  )
}
