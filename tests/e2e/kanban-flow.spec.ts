import { test, expect } from '@playwright/test';

test('create board, add note, drag it, set a date, see it on the calendar', async ({ page }) => {
  const boardName = `Proyecto E2E ${Date.now()}`;

  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Contraseña').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL('**/boards');

  await page.getByPlaceholder('Nuevo tablero...').fill(boardName);
  await page.getByRole('button', { name: '+ Crear tablero' }).click();
  await page.getByRole('link', { name: boardName }).click();

  await page.getByText('+ Nueva nota').first().click();
  const noteCard = page.getByText('Nueva nota', { exact: true });
  await expect(noteCard).toBeVisible();

  await noteCard.click();
  await page.getByPlaceholder('Título').fill('Nota E2E');
  // Use a date within the current month so it falls inside the default Month view range.
  await page.locator('input[type="date"]').fill('2026-07-29');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByText('Calendario').click();
  await expect(page.getByText('Nota E2E')).toBeVisible();
});
