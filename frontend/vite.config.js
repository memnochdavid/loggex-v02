import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // El cliente se conecta a Caddy en el puerto externo 8443
      host: 'localhost',
      clientPort: 8443,
      protocol: 'wss'
    },
    watch: {
      usePolling: true
    }
  }
})
