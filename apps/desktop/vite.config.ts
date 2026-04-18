import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base — packaged Electron loads the renderer from file:///…/dist/index.html,
  // which breaks absolute /assets/… URLs.
  base: './',
})
