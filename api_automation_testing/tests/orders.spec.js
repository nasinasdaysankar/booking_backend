import { test, expect } from '@playwright/test';
test('orders require auth', async ({ request }) => {
  const res = await request.get(
    'https://bookingbackend-production-2282.up.railway.app/api/orders'
  );

  expect(res.status()).toBe(401);
});
