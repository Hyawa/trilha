import path from 'node:path'
import fs from 'node:fs'
import { _electron as electron } from '@playwright/test'

const exe = path.join(process.cwd(), 'release', '1.0.0', 'win-unpacked', 'Trilha.exe')
const db = path.join(process.cwd(), 'test-results', 'trilha-smoke.db')

for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${db}${suffix}`, { force: true })

const app = await electron.launch({
  executablePath: exe,
  env: { ...process.env, TRILHA_DB_PATH: db },
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)

console.log('title:', await page.title())
console.log('heading:', await page.getByRole('heading', { level: 1 }).first().innerText())
console.log('version:', await app.evaluate(({ app }) => app.getVersion()))

await page.getByRole('button', { name: 'Novo mapa' }).click()
await page.getByPlaceholder(/Programação do zero/).fill('Mapa empacotado')
await page.getByRole('button', { name: 'Criar mapa' }).click()
await page.waitForTimeout(700)
console.log('mapa visível:', await page.getByRole('button', { name: 'Criar fase' }).isVisible())

await app.close()

const again = await electron.launch({
  executablePath: exe,
  env: { ...process.env, TRILHA_DB_PATH: db },
})
const page2 = await again.firstWindow()
await page2.waitForLoadState('domcontentloaded')
await page2.waitForTimeout(1200)
console.log('persistiu:', await page2.getByText('Mapa empacotado').first().isVisible())
await again.close()
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${db}${suffix}`, { force: true })
