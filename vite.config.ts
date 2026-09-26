import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative so the build works under github.io/caro-website/
  base: './',
  plugins: [react()],
})
