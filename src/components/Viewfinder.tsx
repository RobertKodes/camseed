import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { clampCrop, cropInViewport, DEFAULT_CROP, type CropNorm } from '../lib/cover'
import type { SampleSource } from '../lib/pixels'

export type MediaLive = {
  kind: 'live'
  stream: MediaStream
  mirrored: boolean
}

export type MediaStill = {
  kind: 'still'
  url: string
  bitmap: ImageBitmap
  mirrored: boolean
}

export type Media = MediaLive | MediaStill

export type ViewfinderHandle = {
  getSampleSource(): SampleSource | null
  getVideo(): HTMLVideoElement | null
}

type Props = {
  media: Media | null
  crop: CropNorm
  onCrop: (crop: CropNorm) => void
  onDropFile: (file: File) => void
  dragging: boolean
  onDragging: (on: boolean) => void
  interactive: boolean
}

export const Viewfinder = forwardRef<ViewfinderHandle, Props>(function Viewfinder(
  { media, crop, onCrop, onDropFile, dragging, onDragging, interactive },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const drag = useRef<{ px: number; py: number; crop: CropNorm } | null>(null)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video || media?.kind !== 'live') return
    video.srcObject = media.stream
    void video.play().catch(() => {})
    return () => {
      video.srcObject = null
    }
  }, [media])

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    getSampleSource: () => {
      const stage = stageRef.current
      if (!stage || !media) return null
      const viewW = stage.clientWidth
      const viewH = stage.clientHeight
      if (media.kind === 'live') {
        const video = videoRef.current
        if (!video || video.videoWidth === 0) return null
        return {
          element: video,
          width: video.videoWidth,
          height: video.videoHeight,
          mirrored: media.mirrored,
          viewW,
          viewH,
        }
      }
      return {
        element: media.bitmap,
        width: media.bitmap.width,
        height: media.bitmap.height,
        mirrored: media.mirrored,
        viewW,
        viewH,
      }
    },
  }))

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { px: e.clientX, py: e.clientY, crop }
      setHint(false)
    },
    [crop, interactive],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const start = drag.current
      const stage = stageRef.current
      if (!start || !stage) return
      const w = stage.clientWidth
      const h = stage.clientHeight
      const next = clampCrop(
        {
          ...start.crop,
          cx: start.crop.cx + (e.clientX - start.px) / w,
          cy: start.crop.cy + (e.clientY - start.py) / h,
        },
        w,
        h,
      )
      onCrop(next)
    },
    [onCrop],
  )

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  const onDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      onDragging(true)
    },
    [onDragging],
  )

  const onDragLeave = useCallback(() => {
    onDragging(false)
  }, [onDragging])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      onDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) onDropFile(file)
    },
    [onDropFile, onDragging],
  )

  const stage = stageRef.current
  const rect = cropInViewport(crop, stage?.clientWidth ?? 1, stage?.clientHeight ?? 1)

  return (
    <div
      ref={stageRef}
      className={`stage${dragging ? ' is-drop' : ''}${media ? ' has-media' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {media?.kind === 'live' && (
        <video
          ref={videoRef}
          className={`media${media.mirrored ? ' is-mirror' : ''}`}
          playsInline
          muted
          autoPlay
        />
      )}
      {media?.kind === 'still' && (
        <img
          className={`media${media.mirrored ? ' is-mirror' : ''}`}
          src={media.url}
          alt="frozen frame"
          draggable={false}
        />
      )}

      <div className="glass" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />

      {media && (
        <div
          className={`reticle${interactive ? ' is-live' : ''}`}
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="tick tick-tl" />
          <span className="tick tick-tr" />
          <span className="tick tick-bl" />
          <span className="tick tick-br" />
          <span className="ground" />
          {interactive && hint && <em className="nudge">nudge</em>}
        </div>
      )}
    </div>
  )
})

export { DEFAULT_CROP }
