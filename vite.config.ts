import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
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
        registerType: 'autoUpdate',
        includeAssets: ['logo_babylonpress.png', 'sql-wasm.wasm'],
        manifest: {
          name: 'STELLAR DESCENT',
          short_name: 'Stellar Descent',
          description: "A tactical combat experience set in humanity's first interstellar frontier",
          theme_color: '#1a1a1a',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'logo_babylonpress.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
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
    },
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
