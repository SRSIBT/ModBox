import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/covers': 'http://localhost:3000',
        '/backgrounds': 'http://localhost:3000',
        '/builtin-covers': 'http://localhost:3000',
        '/builtin-bg': 'http://localhost:3000'
      }
    },
    plugins: [vue()]
  }
})
