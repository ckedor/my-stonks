import { expect, test } from './fixtures/app'

/* Primeira tela migrada para o design system. O snapshot existe para provar
   que a migração das próximas não muda o que se vê. */

const USERS = [
  { id: 1, username: 'ana', email: 'ana@my-stonks.test', is_active: true, is_superuser: true, is_verified: true },
  { id: 2, username: 'bruno', email: 'bruno@my-stonks.test', is_active: true, is_superuser: false, is_verified: true },
  { id: 3, username: 'carla', email: 'carla@my-stonks.test', is_active: false, is_superuser: false, is_verified: false },
]

test('admin/users — listagem', async ({ page, mockApi }) => {
  await mockApi('/users', USERS)

  await page.goto('/admin/users')

  await expect(page.getByRole('heading', { name: 'Gerenciamento de Usuários' })).toBeVisible()
  await expect(page.getByText('bruno@my-stonks.test')).toBeVisible()

  await expect(page).toHaveScreenshot('admin-users.png', { fullPage: true })
})

test('admin/users — diálogo de exclusão', async ({ page, mockApi }) => {
  await mockApi('/users', USERS)

  await page.goto('/admin/users')
  await expect(page.getByText('bruno@my-stonks.test')).toBeVisible()

  /* O diálogo veio do design system nesta migração; vale um snapshot
     próprio, porque é o componente que oito telas vão reusar. */
  await page.getByRole('row', { name: /bruno/ }).getByRole('button').last().click()

  await expect(page.getByRole('heading', { name: 'Confirmar Exclusão' })).toBeVisible()
  await expect(page).toHaveScreenshot('admin-users-delete-dialog.png')
})
