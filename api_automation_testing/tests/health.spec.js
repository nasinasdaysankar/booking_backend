// tests/health.spec.js
import { test, expect } from '@playwright/test';

test('API is alive', async ({ request }) => {
  const res = await request.get(
    'https://bookingbackend-production-2282.up.railway.app/'
  );

  expect(res.status()).toBe(200);
});
