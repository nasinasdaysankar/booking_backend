import { test, expect } from '@playwright/test';

test('public menu loads', async ({ request }) => {
  const res = await request.get(
    'https://bookingbackend-production-2282.up.railway.app/api/menu/public/1'
  );

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);
});
