import { request } from '@playwright/test';
import fs from 'fs';

export default async () => {
  const context = await request.newContext({
    baseURL: process.env.BASE_URL,
  });

  const res = await context.post('/api/auth/login', {
    data: {
      email: 'testuser@gmail.com',
      password: '123456',
    },
  });

  if (!res.ok()) {
    throw new Error('❌ Failed to login test user');
  }

  const body = await res.json();

  fs.writeFileSync(
    'storageState.json',
    JSON.stringify({ token: body.token })
  );
};
