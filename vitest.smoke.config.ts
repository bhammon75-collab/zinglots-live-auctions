import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['**/*.smoke.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
