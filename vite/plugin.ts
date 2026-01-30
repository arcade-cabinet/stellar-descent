import type { PluginOption } from 'vite';
import viteCompression from 'vite-plugin-compression';
import glsl from 'vite-plugin-glsl';
import { createHtmlPlugin } from 'vite-plugin-html';

const vitePlugins = (env: Record<string, string>): PluginOption => {
  if (!env?.VITE_APP_TITLE) {
    throw new Error('VITE_APP_TITLE is required to render the HTML title.');
  }
  return [
    glsl(), // Convenient for you to write shader
    viteCompression({
      verbose: true, // Whether to output compression results on the console
      disable: false, // Do not disable compression
      deleteOriginFile: false, // Whether to delete the original file after compression
      threshold: 10240, // Whether to delete the original file after compression
      ext: '.gz', // file type
      algorithm: 'gzip', // Compression algorithm
    }),
    createHtmlPlugin({
      inject: {
        data: {
          title: env.VITE_APP_TITLE, // Need to reference environment variables in html
        },
      },
    }),
  ];
};

export { vitePlugins };
