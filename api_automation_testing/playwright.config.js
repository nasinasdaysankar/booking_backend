import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: 1,               // ✅ Best for API tests
  timeout: 15000,

  // 📊 REPORTERS (THIS CREATES REPORT)
  reporter: [
    ['list'],               // console output (what you already see)
    ['html', { open: 'never' }], // HTML report
  ],

  use: {
    baseURL: 'https://bookingbackend-production-2282.up.railway.app',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
});
