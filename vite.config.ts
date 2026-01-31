import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { vitePlugins } from './vite/plugin';

function pathResolve(dir: string) {
  return resolve(__dirname, '.', dir);
}

// https://vitejs.dev/config/
export default ({ mode }: any) => {
  const root = process.cwd();
  const env = loadEnv(mode, root);
  return defineConfig({
    base: env.VITE_PUBLIC_PATH,
    root,
    // plugin
    plugins: [
      react(),
      ...vitePlugins(env),
      VitePWA({
        registerType: 'prompt', // Prompt user before updating
        includeAssets: [
          'logo_babylonpress.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          name: 'STELLAR DESCENT: PROXIMA BREACH',
          short_name: 'Stellar Descent',
          description:
            "A tactical arcade shooter set in humanity's first interstellar frontier. Play offline as a PWA.",
          theme_color: '#1a1a1a',
          background_color: '#000000',
          display: 'fullscreen',
          orientation: 'landscape',
          start_url: '/',
          scope: '/',
          categories: ['games', 'entertainment'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: 'screenshot-wide.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Tactical Combat Gameplay',
            },
          ],
        },
        workbox: {
          // Increase cache size limit for game assets (large vehicle models)
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB

          // Glob patterns for precaching
          globPatterns: [
            '**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2,ttf,eot}',
            '**/*.{glb,gltf,bin}',
            '**/*.{ogg,mp3,wav}',
            '**/*.wasm',
          ],

          // Exclude very large NPC models from precaching (>15MB)
          // They will be cached at runtime via runtimeCaching when first loaded
          globIgnores: [
            '**/models/npcs/marine/marine_elite.glb',
            '**/models/npcs/marine/marine_crusader.glb',
          ],

          // Runtime caching strategies
          runtimeCaching: [
            // Cache-first for video files (splash videos are ~12MB each, don't precache)
            {
              urlPattern: /\.(?:mp4|webm)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-video',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache-first for models (GLB/GLTF files)
            {
              urlPattern: /\.(?:glb|gltf|bin)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-models',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache-first for textures
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-textures',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache-first for audio files
            {
              urlPattern: /\.(?:ogg|mp3|wav)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-audio',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache-first for WASM files
            {
              urlPattern: /\.wasm$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-wasm',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Stale-while-revalidate for fonts
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'game-fonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Network-first for Google Fonts (external)
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],

          // Skip waiting when prompted
          skipWaiting: false, // We use prompt mode, user decides when to update
          clientsClaim: true,

          // Clean up old caches
          cleanupOutdatedCaches: true,
        },
        // Development options
        devOptions: {
          enabled: true, // Enable PWA in dev mode for testing
          type: 'module',
          suppressWarnings: true,
        },
      }),
    ],
    // alias
    resolve: {
      alias: {
        '@': pathResolve('src'),
      },
      extensions: ['.js', '.ts', '.tsx', '.json'],
    },
    esbuild: {
      pure: mode === 'production' ? ['console.log'] : [],
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
      open: false,
      hmr: true,
      cors: true,
      headers: {
        // Ensure WASM files are served with correct MIME type
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    // Ensure WASM files can be loaded
    assetsInclude: ['**/*.wasm'],
    build: {
      target: 'esnext',
      outDir: 'dist',
      chunkSizeWarningLimit: 600, // Increased slightly to avoid warning for index chunk
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
        },
      },
    },
    optimizeDeps: {
      exclude: ['@babylonjs/havok'],
    },
  });
};
