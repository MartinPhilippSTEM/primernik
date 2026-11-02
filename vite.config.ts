import { defineConfig } from 'vite';

// Relativní cesty → stránka funguje na GitHub Pages v podsložce (https://<uživatel>.github.io/primernik/).
export default defineConfig({
  base: './',
  // data jsou přibalená do jednoho souboru (~190 kB gzip) – pro interní nástroj v pořádku
  build: { chunkSizeWarningLimit: 3000 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
