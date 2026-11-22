import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        main: resolve(__dirname, 'main.html'),
        trips: resolve(__dirname, 'trips.html'),
        login: resolve(__dirname, 'login.html'),
      },
    },
  },
});
