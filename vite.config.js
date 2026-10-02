import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": cuando subas cambios y el celular tenga internet, la nueva
      // versión se descarga en segundo plano y se activa en la siguiente apertura
      // de la app, sin que tengas que hacer nada ni reinstalar.
      registerType: 'autoUpdate',

      // Esto es lo que permite que la app abra SIN internet: la primera vez que
      // se usa con conexión, el service worker guarda una copia de estos archivos.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        // Ojo: a propósito NO incluimos imágenes (png/jpg/webp) aquí. Así tu
        // carpeta public/ejercicios puede crecer sin que cada imagen quede
        // "obligada" a descargarse de antemano para que la app funcione offline.
      },

      manifest: {
        name: 'Rutina - Control de gimnasio',
        short_name: 'Rutina',
        description: 'Lleva el control de tu rutina de gimnasio',
        theme_color: '#1C1B19',
        background_color: '#1C1B19',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
