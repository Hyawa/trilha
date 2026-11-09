import fs from 'node:fs'
import path from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

const dbPath = path.join(process.cwd(), 'test-results', 'trilha-e2e.db')

function cleanDb(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true })
  }
}

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      TRILHA_DB_PATH: dbPath,
    } as Record<string, string>,
  })
  const page = await app.firstWindow()
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[renderer:${message.type()}]`, message.text())
    }
  })
  page.on('pageerror', (error) => console.log('[pageerror]', error.message))
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

test.describe.serial('Trilha — fluxo completo', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    cleanDb()
    const launched = await launch()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async () => {
    await app?.close().catch(() => undefined)
    cleanDb()
  })

  test('cria mapa, fase, tópico e persiste tudo', async () => {
    await expect(page.getByRole('heading', { name: 'Seus mapas de estudo' })).toBeVisible()

    await page.getByRole('button', { name: 'Novo mapa' }).click()
    await page.getByPlaceholder(/Programação do zero/).fill('Mapa E2E')
    await page.getByRole('button', { name: 'Criar mapa' }).click()

    await expect(page.getByText('Mapa E2E').first()).toBeVisible()

    await page.getByPlaceholder(/Fundamentos, Prática, Projeto final/).fill('Fundamentos')
    await page.getByRole('button', { name: 'Criar fase' }).click()
    await expect(page.getByText('Fundamentos', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar tópico' }).click()
    await page.getByPlaceholder('Nome do tópico…').fill('Primeiro tópico')
    await page.getByPlaceholder('Nome do tópico…').press('Enter')
    await expect(page.getByText('Primeiro tópico', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Ações do tópico', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Detalhes e anotações' }).click()
    await expect(page.getByRole('dialog', { name: /Primeiro tópico/ })).toBeVisible()
    const dialog = page.getByRole('dialog', { name: /Primeiro tópico/ })

    await dialog.getByRole('button', { name: 'Concluído', exact: true }).click()
    await expect(page.getByText('Trilha concluída')).toBeVisible()

    await dialog.getByPlaceholder('Adicionar item…').fill('Ler o capítulo 1')
    await dialog.getByPlaceholder('Adicionar item…').press('Enter')
    await expect(dialog.getByText('Ler o capítulo 1')).toBeVisible()

    await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await dialog.getByPlaceholder('Nome do recurso').fill('Documentação oficial')
    await dialog.getByPlaceholder('https://…').fill('example.com/docs')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog.getByText('Documentação oficial')).toBeVisible()
    await expect(page.getByText(/example\.com/)).toBeVisible()

    await dialog.getByPlaceholder(/Resumos, dúvidas, insights/).fill('# Primeiro resumo\n- anotação **forte**')
    await dialog.getByRole('button', { name: 'Ver', exact: true }).click()
    await expect(page.locator('.notes-preview h3')).toHaveText('Primeiro resumo')
    await expect(page.locator('.notes-preview strong')).toHaveText('forte')

    await page.waitForTimeout(1200)
    await dialog.getByRole('button', { name: 'Fechar' }).click()

    await app.close()

    const relaunched = await launch()
    app = relaunched.app
    page = relaunched.page

    await expect(page.getByText('Mapa E2E').first()).toBeVisible()
    await expect(page.getByText('Primeiro tópico', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Ações do tópico', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Detalhes e anotações' }).click()
    const reopened = page.getByRole('dialog', { name: /Primeiro tópico/ })
    await expect(reopened).toBeVisible()
    await expect(reopened.getByText('Ler o capítulo 1')).toBeVisible()
    await expect(reopened.getByText('Documentação oficial')).toBeVisible()
    await reopened.getByRole('button', { name: 'Ver', exact: true }).click()
    await expect(page.locator('.notes-preview h3')).toHaveText('Primeiro resumo')
  })
})


