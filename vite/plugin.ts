import type { PluginOption } from 'vite';
import viteCompression from 'vite-plugin-compression';
import glsl from 'vite-plugin-glsl';
import { createHtmlPlugin } from 'vite-plugin-html';

const vitePlugins = (env: Record<string, string>): PluginOption => {
  const appTitle = env?.VITE_APP_TITLE || 'STELLAR DESCENT: PROXIMA BREACH';
  return [
    glsl(), // Convenient for you to write shader
    viteCompression({
      verbose: true, // Whether to output compression results on the console
      disable: false, // Do not disable compression
      deleteOriginFile: false, // Whether to delete the original file after compression
      threshold: 10240, // Only compress files larger than this size (bytes)
      ext: '.gz', // file type
      algorithm: 'gzip', // Compression algorithm
    }),
    createHtmlPlugin({
      inject: {
        data: {
          title: appTitle, // Need to reference environment variables in html
        },
      },
    }),
  ];
};

export { vitePlugins };
