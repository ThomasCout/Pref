import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* Génère sw.js avec la liste exacte des fichiers de l'app (noms hachés) à mettre en cache hors ligne. */
function swPlugin(): Plugin {
  return {
    name: 'sw-precache',
    apply: 'build',
    async generateBundle(_o, bundle) {
      const fs = await import('node:fs')
      const tpl = fs.readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf-8')
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map'))
      const shell = ['./', 'index.html', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', ...files]
      const version = Date.now().toString(36)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: tpl.replace('__SHELL__', JSON.stringify(shell)).replace('__VERSION__', version) })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), swPlugin()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
})
