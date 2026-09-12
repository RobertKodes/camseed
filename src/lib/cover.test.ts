import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { clampCrop, coverMap, cropInViewport, viewportCropToSource } from './cover'
import { boxAverageRgb } from './pixels'

if (!globalThis.Buffer) globalThis.Buffer = Buffer

describe('coverMap', () => {
  it('crops the sides of a wide source', () => {
    const map = coverMap(200, 100, 100, 100)
    expect(map.srcY).toBe(0)
    expect(map.srcH).toBe(100)
    expect(map.srcW).toBe(100)
    expect(map.srcX).toBe(50)
    expect(map.scale).toBe(1)
  })

  it('crops the top/bottom of a tall source', () => {
    const map = coverMap(100, 200, 100, 100)
    expect(map.srcX).toBe(0)
    expect(map.srcW).toBe(100)
    expect(map.srcH).toBe(100)
    expect(map.srcY).toBe(50)
  })
})

describe('crop + source mapping', () => {
  it('maps a centered square through cover without mirroring', () => {
    const map = coverMap(200, 100, 100, 100)
    const crop = cropInViewport({ cx: 0.5, cy: 0.5, size: 0.5 }, 100, 100)
    expect(crop.w).toBe(50)
    expect(crop.h).toBe(50)
    const src = viewportCropToSource(crop, map, false, 100)
    expect(src.sw).toBeCloseTo(50)
    expect(src.sh).toBeCloseTo(50)
    expect(src.sx).toBeCloseTo(75)
  })

  it('mirrors x when the viewfinder is flipped', () => {
    const map = coverMap(100, 100, 100, 100)
    const crop = { x: 10, y: 20, w: 20, h: 20 }
    const plain = viewportCropToSource(crop, map, false, 100)
    const flip = viewportCropToSource(crop, map, true, 100)
    expect(plain.sx).toBeCloseTo(10)
    expect(flip.sx).toBeCloseTo(70)
    expect(flip.sy).toBe(plain.sy)
  })

  it('keeps the square inside the viewport when clamped', () => {
    const next = clampCrop({ cx: 0, cy: 0, size: 0.4 }, 200, 100)
    const rect = cropInViewport(next, 200, 100)
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.w).toBeLessThanOrEqual(200)
    expect(rect.y + rect.h).toBeLessThanOrEqual(100)
  })
})

describe('boxAverageRgb', () => {
  it('averages a 2×2 of identical red pixels into one red cell', () => {
    const rgba = new Uint8Array(2 * 2 * 4)
    for (let i = 0; i < 4; i++) {
      rgba[i * 4] = 200
      rgba[i * 4 + 1] = 10
      rgba[i * 4 + 2] = 4
      rgba[i * 4 + 3] = 255
    }
    const rgb = boxAverageRgb(rgba, 2, 1)
    expect(Array.from(rgb)).toEqual([200, 10, 4])
  })
})
