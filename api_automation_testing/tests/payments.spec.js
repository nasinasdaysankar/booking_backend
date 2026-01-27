import { test, expect } from '@playwright/test';
test('payment service alive', async ({ request }) => {
  const res = await request.get(
    'https://bookingbackend-production-2282.up.railway.app/api/payments/health'
  );

  expect(res.status()).toBeLessThan(500);
});
