import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    deps: {
      inline: ['@testing-library/react', 'react', 'react-dom']
    }
  }
})
