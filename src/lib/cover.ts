export type CoverMap = {
  srcX: number
  srcY: number
  srcW: number
  srcH: number
  scale: number
}

export type CropNorm = {
  /** Center of the square, 0..1 in the visible viewport. */
  cx: number
  cy: number
  /** Side length as a fraction of min(viewport w, h). */
  size: number
}

export type Rect = { x: number; y: number; w: number; h: number }

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Visible source rectangle when a media box is drawn with object-fit: cover. */
export function coverMap(srcW: number, srcH: number, dstW: number, dstH: number): CoverMap {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { srcX: 0, srcY: 0, srcW: Math.max(srcW, 1), srcH: Math.max(srcH, 1), scale: 1 }
  }
  const srcAspect = srcW / srcH
  const dstAspect = dstW / dstH
  if (srcAspect > dstAspect) {
    const scale = dstH / srcH
    const overflow = (srcW * scale - dstW) / 2
    return { srcX: overflow / scale, srcY: 0, srcW: dstW / scale, srcH: srcH, scale }
  }
  const scale = dstW / srcW
  const overflow = (srcH * scale - dstH) / 2
  return { srcX: 0, srcY: overflow / scale, srcW: srcW, srcH: dstH / scale, scale }
}

export function cropInViewport(crop: CropNorm, viewW: number, viewH: number): Rect {
  const side = Math.min(viewW, viewH) * crop.size
  const x = crop.cx * viewW - side / 2
  const y = crop.cy * viewH - side / 2
  return {
    x: clamp(x, 0, Math.max(0, viewW - side)),
    y: clamp(y, 0, Math.max(0, viewH - side)),
    w: side,
    h: side,
  }
}

export function clampCrop(crop: CropNorm, viewW: number, viewH: number): CropNorm {
  if (viewW <= 0 || viewH <= 0) return crop
  const side = Math.min(viewW, viewH) * crop.size
  const minCx = side / 2 / viewW
  const maxCx = 1 - minCx
  const minCy = side / 2 / viewH
  const maxCy = 1 - minCy
  return {
    ...crop,
    cx: clamp(crop.cx, Math.min(minCx, maxCx), Math.max(minCx, maxCx)),
    cy: clamp(crop.cy, Math.min(minCy, maxCy), Math.max(minCy, maxCy)),
  }
}

/** Map a viewport crop through object-fit: cover into source pixels. */
export function viewportCropToSource(
  cropPx: Rect,
  map: CoverMap,
  mirrored: boolean,
  viewW: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const vx = mirrored ? viewW - cropPx.x - cropPx.w : cropPx.x
  return {
    sx: map.srcX + vx / map.scale,
    sy: map.srcY + cropPx.y / map.scale,
    sw: cropPx.w / map.scale,
    sh: cropPx.h / map.scale,
  }
}

export const DEFAULT_CROP: CropNorm = { cx: 0.5, cy: 0.48, size: 0.44 }
