import { coverMap, cropInViewport, viewportCropToSource, type CropNorm } from './cover'

/** Downsample grid hashed into the address. Keep this fixed. */
export const GRID = 32
const WORK = 128

export type SampleSource = {
  element: CanvasImageSource
  width: number
  height: number
  mirrored: boolean
  viewW: number
  viewH: number
}

function workCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = WORK
  c.height = WORK
  return c
}

/** Box-average RGBA `srcSize×srcSize` into `grid×grid` RGB. Deterministic. */
export function boxAverageRgb(
  rgba: Uint8Array | Uint8ClampedArray,
  srcSize: number,
  grid: number,
): Uint8Array {
  if (srcSize <= 0 || grid <= 0 || srcSize % grid !== 0) {
    throw new Error(`srcSize (${srcSize}) must be a positive multiple of grid (${grid})`)
  }
  const cell = srcSize / grid
  const out = new Uint8Array(grid * grid * 3)
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const i = ((gy * cell + y) * srcSize + (gx * cell + x)) * 4
          r += rgba[i] ?? 0
          g += rgba[i + 1] ?? 0
          b += rgba[i + 2] ?? 0
          n++
        }
      }
      const o = (gy * grid + gx) * 3
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
    }
  }
  return out
}

export function sampleRgbFromSource(source: SampleSource, crop: CropNorm): Uint8Array {
  const { element, width, height, mirrored, viewW, viewH } = source
  if (width <= 0 || height <= 0 || viewW <= 0 || viewH <= 0) {
    throw new Error('media not ready')
  }
  const map = coverMap(width, height, viewW, viewH)
  const cropPx = cropInViewport(crop, viewW, viewH)
  const { sx, sy, sw, sh } = viewportCropToSource(cropPx, map, mirrored, viewW)

  const canvas = workCanvas()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.clearRect(0, 0, WORK, WORK)
  ctx.drawImage(element, sx, sy, sw, sh, 0, 0, WORK, WORK)
  const { data } = ctx.getImageData(0, 0, WORK, WORK)
  return boxAverageRgb(data, WORK, GRID)
}

export async function stillFromFile(file: File): Promise<{ bitmap: ImageBitmap; url: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)
  })
  return { bitmap, url: URL.createObjectURL(blob) }
}

export async function freezeFromVideo(video: HTMLVideoElement): Promise<{
  bitmap: ImageBitmap
  url: string
}> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(video, 0, 0)
  const bitmap = await createImageBitmap(canvas)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)
  })
  return { bitmap, url: URL.createObjectURL(blob) }
}
