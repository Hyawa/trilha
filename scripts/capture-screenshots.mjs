// Captura as telas usadas no README, a partir do app já empacotado.
// Semeia dados de exemplo via IPC (window.trilha) num banco temporário.
import path from 'node:path'
import fs from 'node:fs'
import { _electron as electron } from '@playwright/test'

const exe = path.join(process.cwd(), 'release', '1.0.0', 'win-unpacked', 'Trilha.exe')
const db = path.join(process.cwd(), 'test-results', 'trilha-shots.db')
const outDir = path.join(process.cwd(), 'docs')

for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${db}${suffix}`, { force: true })
fs.mkdirSync(outDir, { recursive: true })

const app = await electron.launch({ executablePath: exe, env: { ...process.env, TRILHA_DB_PATH: db } })
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1300, 900))
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

const boardId = await page.evaluate(async () => {
  const api = window.trilha

  const main = await api.boards.create({
    title: 'Programação do zero',
    description: 'Do primeiro algoritmo ao projeto publicado.',
    emoji: '💻',
    color: '#3f6b5b',
  })

  const phase = (title, description) =>
    api.nodes.create({ boardId: main.id, parentId: null, kind: 'phase', title, description })

  const p1 = await phase('Fundamentos', 'Entender como o computador executa instruções.')
  const p2 = await phase('Ferramentas do dia a dia', 'Terminal, Git e um editor de verdade.')
  const p3 = await phase('Projeto final', 'Colocar tudo junto em algo que você mostre.')

  const topic = (parentId, title) =>
    api.nodes.create({ boardId: main.id, parentId, kind: 'topic', title })

  const t1 = await topic(p1.id, 'Lógica e algoritmos')
  await api.nodes.create({ boardId: main.id, parentId: t1.id, kind: 'subtopic', title: 'Variáveis e tipos' })
  await api.nodes.create({ boardId: main.id, parentId: t1.id, kind: 'subtopic', title: 'Condicionais e laços' })
  const t1b = await topic(p1.id, 'Como o computador executa código')

  const t2 = await topic(p2.id, 'Git e GitHub')
  await api.nodes.create({ boardId: main.id, parentId: t2.id, kind: 'subtopic', title: 'Commits e branches' })
  await api.nodes.create({ boardId: main.id, parentId: t2.id, kind: 'subtopic', title: 'Pull requests' })
  const t2b = await topic(p2.id, 'Linha de comando')
  const t3 = await topic(p3.id, 'Publicar o primeiro projeto')

  await api.nodes.update(t1.id, {
    status: 'done',
    estimatedMinutes: 180,
    description: 'Base de tudo: pensar em passos que o computador entende.',
    notes: '## Resumo\n\n- Algoritmo é **sequência finita** de passos\n- Testar no papel antes de codar\n- [Material de apoio](https://example.com)',
  })
  await api.checklist.create({ nodeId: t1.id, text: 'Escrever 10 algoritmos no papel', done: true })
  await api.checklist.create({ nodeId: t1.id, text: 'Resolver desafios de laços', done: true })
  await api.resources.create({
    nodeId: t1.id,
    kind: 'video',
    title: 'Curso introdutório de lógica',
    url: 'https://example.com/curso',
  })

  await api.nodes.update(t1b.id, { status: 'done', estimatedMinutes: 90 })
  await api.nodes.update(t2.id, {
    status: 'studying',
    estimatedMinutes: 120,
    notes: 'Fluxo diário: `add`, `commit`, `push`.',
  })
  await api.checklist.create({ nodeId: t2.id, text: 'Criar repositório de testes', done: true })
  await api.checklist.create({ nodeId: t2.id, text: 'Abrir meu primeiro pull request' })
  await api.resources.create({
    nodeId: t2.id,
    kind: 'book',
    title: 'Pro Git (gratuito)',
    url: 'https://git-scm.com/book/pt-br',
  })
  await api.nodes.update(t2b.id, { estimatedMinutes: 60 })

  await api.boards.create({
    title: 'Inglês para viagem',
    description: 'Conversação para o dia a dia e aeroporto.',
    emoji: '🗣️',
    color: '#2f6f8f',
  })
  await api.boards.create({
    title: 'Anatomia humana',
    description: 'Sistemas do corpo com foco em provas.',
    emoji: '🧠',
    color: '#7a5489',
  })

  return { boardId: main.id, phaseId: p1.id, topicId: t2.id, lastTopic: t3.id }
})

await page.evaluate(async (id) => window.trilha.settings.set('lastBoard', id), boardId.boardId)
await page.reload()
await page.waitForTimeout(1600)
await page.screenshot({ path: path.join(outDir, 'preview-trilha.png') })

// painel do tópico
await page.getByRole('button', { name: 'Ações do tópico', exact: true }).first().click()
await page.getByRole('menuitem', { name: 'Detalhes e anotações' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outDir, 'preview-topico.png') })
await page.getByRole('button', { name: 'Fechar' }).click()

// biblioteca
await page.evaluate(async () => window.trilha.settings.set('lastBoard', ''))
await page.reload()
await page.waitForTimeout(1400)
await page.screenshot({ path: path.join(outDir, 'preview-biblioteca.png') })

await app.close()
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${db}${suffix}`, { force: true })
console.log('Telas salvas em docs/')
