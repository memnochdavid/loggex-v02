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
    },
    // Warmup sólo del entry + App. Vite sigue los imports estáticos
    // transitivamente y transforma todas las páginas importadas desde
    // App.jsx. Incluir muchos ficheros aquí alarga el boot y puede
    // provocar 503 en transforms paralelos mientras se calientan.
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx']
    }
  },
  // Pre-bundling de npm deps. Listamos TODAS las dependencias de runtime
  // del proyecto para que Vite las meta en el pre-bundle inicial. Si se
  // descubren tarde (ej. primera carga de una página CRUD que importa
  // react-draggable), Vite dispara una re-optimización y devuelve 503
  // a todos los transforms en vuelo → fallos en cascada en la UI.
  optimizeDeps: {
    // Todas las deps runtime de package.json. Si alguna falta y se
    // descubre tarde, Vite re-optimiza y devuelve 503 a requests en
    // vuelo. Aquí están listadas TODAS.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-i18next',
      'i18next',
      'lucide-react',
      'lottie-react',
      'react-draggable',
      'react-joyride',
      // Sub-dep CJS de react-joyride. Su index.mjs hace
      // `import deepmerge from './index.js'` (CJS) y, si Vite no lo
      // pre-bundlea, el navegador lo carga como ESM nativo y revienta
      // con "does not provide an export named 'default'".
      '@fastify/deepmerge',
      'perfect-freehand',
      '@dnd-kit/core',
      '@dnd-kit/modifiers',
      // Recharts (Fase 8 PL — vista Proyección del tab Consumición).
      // Recharts 2 importa `default` desde subpaths de lodash CJS
      // (`import get from 'lodash/get'`). Sin pre-bundling, Vite carga
      // el .js como ESM nativo y peta con "does not provide an export
      // named 'default'". Pre-bundleando recharts, esbuild interopera
      // CJS↔ESM correctamente.
      'recharts',
      'sonner',
    ],
    // noDiscovery desactiva el escaneo on-demand de nuevas dependencias
    // durante el dev. Cualquier dep debe estar en `include` o en los
    // imports estáticos que Vite resuelve al arrancar. Efecto: en vez
    // de 503 silencioso, cualquier dep faltante producirá un error de
    // módulo claro.
    noDiscovery: true,
    // Mantiene las peticiones pendientes hasta que el crawl inicial
    // termina. Elimina 503s del primer paint cuando el crawl tarda.
    holdUntilCrawlEnd: true,
  }
})
