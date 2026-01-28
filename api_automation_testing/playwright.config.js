import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: 1,
  globalSetup: './auth.setup.js',

  use: {
    baseURL: process.env.BASE_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
});
