import { test, expect } from '@playwright/test';


test('banners load', async ({ request }) => {
  const res = await request.get(
    'https://bookingbackend-production-2282.up.railway.app/api/banners'
  );

  expect(res.status()).toBe(200);
});
