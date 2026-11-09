// Gera build/icon.png (512×512) sem dependências externas.
// Marca do Trilha: uma rota pontilhada com três estações sobre um selo verde.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SIZE = 512
const SS = 3 // supersampling por eixo

const GREEN = [63, 107, 91]
const GREEN_DARK = [46, 82, 69]
const CREAM = [247, 244, 238]
const AMBER = [214, 160, 71]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function roundedRect(x, y, left, top, width, height, radius) {
  const dx = Math.max(left + radius - x, 0, x - (left + width - radius))
  const dy = Math.max(top + radius - y, 0, y - (top + height - radius))
  return Math.hypot(dx, dy) - radius <= 0
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const length = vx * vx + vy * vy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / length))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

// Rota em "S" do canto inferior esquerdo ao superior direito.
const ROUTE = [
  [134, 402],
  [150, 342],
  [214, 300],
  [252, 258],
  [292, 216],
  [356, 176],
  [382, 118],
]

const STATIONS = [
  { x: 134, y: 402, r: 26, color: CREAM },
  { x: 252, y: 258, r: 22, color: AMBER },
  { x: 382, y: 118, r: 30, color: CREAM },
]

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0

    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS

        let color = null

        // selo arredondado com leve gradiente vertical
        if (roundedRect(px, py, 24, 24, SIZE - 48, SIZE - 48, 112)) {
          color = mix(GREEN, GREEN_DARK, Math.min(1, Math.max(0, (py - 24) / (SIZE - 48))))

          // rota tracejada
          let onRoute = false
          for (let i = 0; i < ROUTE.length - 1; i += 1) {
            const [ax, ay] = ROUTE[i]
            const [bx, by] = ROUTE[i + 1]
            if (segmentDistance(px, py, ax, ay, bx, by) <= 11) {
              onRoute = true
              break
            }
          }

          if (onRoute) {
            // tracejado: alterna conforme a posição ao longo do percurso
            const phase = (px * 0.55 + (SIZE - py) * 0.85) % 46
            if (phase < 27) color = mix(color, CREAM, 0.92)
          }

          for (const station of STATIONS) {
            const distance = Math.hypot(px - station.x, py - station.y)
            if (distance <= station.r) color = station.color
            else if (distance <= station.r + 7) color = mix(color, CREAM, 0.55)
          }
        }

        const alpha = color ? 1 : 0
        if (color) {
          r += color[0] * alpha
          g += color[1] * alpha
          b += color[2] * alpha
          a += alpha
        }
      }
    }

    const total = SS * SS
    const index = (y * SIZE + x) * 4
    if (a === 0) {
      pixels[index] = 0
      pixels[index + 1] = 0
      pixels[index + 2] = 0
      pixels[index + 3] = 0
    } else {
      pixels[index] = Math.round(r / a)
      pixels[index + 1] = Math.round(g / a)
      pixels[index + 2] = Math.round(b / a)
      pixels[index + 3] = Math.round((a / total) * 255)
    }
  }
}

// PNG: filtro 0 por linha
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header[8] = 8 // bit depth
header[9] = 6 // RGBA
header[10] = 0
header[11] = 0
header[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const output = path.join(process.cwd(), 'build', 'icon.png')
mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, png)
console.log(`Ícone gerado: ${output} (${(png.length / 1024).toFixed(1)} kB)`)
