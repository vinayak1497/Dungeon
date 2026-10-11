import { test, expect } from '@playwright/test';

// Smoke: public landing renders, protected routes redirect to signin,
// and API auth boundaries hold without a session.
test('landing renders with Requiem brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Requiem', { exact: false }).first()).toBeVisible();
});

test('dashboard redirects to signin when signed out', async ({ page }) => {
  const res = await page.goto('/dashboard');
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/signin/);
});

test('api auth boundaries hold without session', async ({ request }) => {
  for (const path of ['/api/courses', '/api/profile']) {
    const r = await request.get(path);
    expect(r.status()).toBe(401);
  }
  const r = await request.post('/api/quiz/generate', { data: { courseId: 'x' } });
  expect(r.status()).toBe(401);
});
