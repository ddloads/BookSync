import { defineConfig } from 'vite'
import { builtinModules } from 'module'
import { resolve } from 'path'
import pkg from './package.json'

const external = [
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]

export default defineConfig({
  build: {
    ssr: resolve(__dirname, 'src/web/server.ts'),
    outDir: resolve(__dirname, 'dist-web/server'),
    emptyOutDir: true,
    rollupOptions: {
      external,
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
      },
    },
  },
})
