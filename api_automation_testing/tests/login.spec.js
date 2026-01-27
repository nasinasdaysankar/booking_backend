import { test, expect } from '@playwright/test';

test('login API works', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: {
      email: 'sankar@gmail.com',
      password: '123456',
    },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.token).toBeTruthy();
  expect(body.user.email).toBe('sankar@gmail.com');
});
