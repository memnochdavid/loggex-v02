import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true, // Permitir todos los hosts para ngrok
    hmr: {
      // Dejamos que el cliente infiera el protocolo y host automáticamente
      // Esto es lo más robusto para entornos mixtos (HTTP/HTTPS, Local/Ngrok)
      // Solo forzamos el puerto si es estrictamente necesario, pero Caddy debería manejarlo
      // Al quitar clientPort, Vite usará el puerto de la URL del navegador (8888, 8443, etc.)
      // y el protocolo adecuado (ws o wss).
    },
    watch: {
      usePolling: true
    }
  }
})
