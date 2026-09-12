import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { deriveFromRgb, pdaFromHash, sha256Bytes } from './derive'

if (!globalThis.Buffer) globalThis.Buffer = Buffer

function fillRgb(r: number, g: number, b: number, cells = 4): Uint8Array {
  const rgb = new Uint8Array(cells * 3)
  for (let i = 0; i < cells; i++) {
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }
  return rgb
}

describe('deriveFromRgb', () => {
  it('is stable for the same pixels', async () => {
    const a = await deriveFromRgb(fillRgb(12, 40, 90))
    const b = await deriveFromRgb(fillRgb(12, 40, 90))
    expect(a.address).toBe(b.address)
    expect(a.hashHex).toBe(b.hashHex)
    expect(a.bump).toBe(b.bump)
    expect(a.address.length).toBeGreaterThan(32)
  })

  it('changes when the frame pixels change', async () => {
    const red = await deriveFromRgb(fillRgb(200, 8, 8))
    const blue = await deriveFromRgb(fillRgb(8, 8, 200))
    expect(red.address).not.toBe(blue.address)
    expect(red.hashHex).not.toBe(blue.hashHex)
  })

  it('feeds the camseed namespace into a system-program PDA', async () => {
    const hash = await sha256Bytes(fillRgb(1, 2, 3))
    const { address, bump } = pdaFromHash(hash)
    expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    expect(bump).toBeGreaterThanOrEqual(0)
    expect(bump).toBeLessThanOrEqual(255)
  })
})
