import { useCallback, useEffect, useRef, useState } from 'react'
import { AddressPlate } from './components/AddressPlate'
import { Gate } from './components/Gate'
import {
  DEFAULT_CROP,
  Viewfinder,
  type Media,
  type ViewfinderHandle,
} from './components/Viewfinder'
import { copyText, prefersReducedMotion } from './lib/clipboard'
import { clampCrop, type CropNorm } from './lib/cover'
import { deriveFromRgb, type Derived } from './lib/derive'
import { freezeFromVideo, sampleRgbFromSource, stillFromFile } from './lib/pixels'
import { peekAccount, type PeekResult } from './lib/rpc'

const PEEK_IDLE_MS = 1400

export default function App() {
  const finder = useRef<ViewfinderHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const peekTimer = useRef<number | null>(null)
  const peekGen = useRef(0)
  const stillUrl = useRef<string | null>(null)

  const [media, setMedia] = useState<Media | null>(null)
  const [crop, setCrop] = useState<CropNorm>(DEFAULT_CROP)
  const [derived, setDerived] = useState<Derived | null>(null)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [peek, setPeek] = useState<PeekResult | null>(null)
  const [peeking, setPeeking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<Media | null>(null)
  mediaRef.current = media

  const revokeStill = useCallback(() => {
    if (stillUrl.current) {
      URL.revokeObjectURL(stillUrl.current)
      stillUrl.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    setMedia((current) => {
      if (current?.kind === 'live') {
        for (const track of current.stream.getTracks()) track.stop()
      }
      return current?.kind === 'live' ? null : current
    })
  }, [])

  useEffect(() => {
    return () => {
      revokeStill()
      const current = mediaRef.current
      if (current?.kind === 'live') {
        for (const track of current.stream.getTracks()) track.stop()
      }
    }
  }, [revokeStill])

  const adoptStill = useCallback(
    async (file: File) => {
      setError(null)
      setBusy(true)
      try {
        const still = await stillFromFile(file)
        revokeStill()
        stillUrl.current = still.url
        setMedia((current) => {
          if (current?.kind === 'live') {
            for (const track of current.stream.getTracks()) track.stop()
          }
          return { kind: 'still', url: still.url, bitmap: still.bitmap, mirrored: false }
        })
        setDerived(null)
        setPeek(null)
        setCopied(false)
      } catch {
        setError('could not read that still')
      } finally {
        setBusy(false)
      }
    },
    [revokeStill],
  )

  const openShutter = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      const facing = stream.getVideoTracks()[0]?.getSettings().facingMode
      revokeStill()
      setDenied(false)
      setDerived(null)
      setPeek(null)
      setMedia({ kind: 'live', stream, mirrored: facing === 'user' })
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setDenied(true)
      } else if (name === 'NotFoundError') {
        setDenied(true)
        setError('no camera on this machine — drop a still')
      } else {
        setDenied(true)
        setError('camera refused. drop a still instead.')
      }
    } finally {
      setBusy(false)
    }
  }, [revokeStill])

  const snap = useCallback(async () => {
    const handle = finder.current
    if (!handle || !media) return
    setError(null)

    let source = handle.getSampleSource()
    if (media.kind === 'live') {
      const video = handle.getVideo()
      if (!video || video.videoWidth === 0) {
        setError('frame not ready — wait a beat')
        return
      }
      try {
        const frozen = await freezeFromVideo(video)
        revokeStill()
        stillUrl.current = frozen.url
        for (const track of media.stream.getTracks()) track.stop()
        setMedia({ kind: 'still', url: frozen.url, bitmap: frozen.bitmap, mirrored: media.mirrored })
        source = {
          element: frozen.bitmap,
          width: frozen.bitmap.width,
          height: frozen.bitmap.height,
          mirrored: media.mirrored,
          viewW: source?.viewW ?? 1,
          viewH: source?.viewH ?? 1,
        }
      } catch {
        setError('could not freeze the frame')
        return
      }
    }

    if (!source) {
      setError('nothing in the glass')
      return
    }

    try {
      const rgb = sampleRgbFromSource(source, crop)
      const next = await deriveFromRgb(rgb)
      setDerived(next)
      setCopied(false)
      if (!prefersReducedMotion()) {
        setFlash(true)
        window.setTimeout(() => setFlash(false), 180)
      }
    } catch {
      setError('hash missed — try again')
    }
  }, [crop, media, revokeStill])

  const resnap = useCallback(() => {
    setDerived(null)
    setPeek(null)
    setCopied(false)
    peekGen.current += 1
    setPeeking(false)
  }, [])

  const wipe = useCallback(() => {
    stopCamera()
    revokeStill()
    setMedia(null)
    setDerived(null)
    setPeek(null)
    setCopied(false)
    setCrop(DEFAULT_CROP)
    peekGen.current += 1
    setPeeking(false)
  }, [revokeStill, stopCamera])

  const onCopy = useCallback(async () => {
    if (!derived) return
    const ok = await copyText(derived.address)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1400)
  }, [derived])

  const runPeek = useCallback(async (address: string) => {
    const gen = ++peekGen.current
    setPeeking(true)
    const result = await peekAccount(address)
    if (gen !== peekGen.current) return
    setPeek(result)
    setPeeking(false)
  }, [])

  useEffect(() => {
    setPeek(null)
    if (peekTimer.current) window.clearTimeout(peekTimer.current)
    if (!derived) return
    peekTimer.current = window.setTimeout(() => {
      void runPeek(derived.address)
    }, PEEK_IDLE_MS)
    return () => {
      if (peekTimer.current) window.clearTimeout(peekTimer.current)
    }
  }, [derived?.address, runPeek])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (derived) resnap()
        return
      }
      if (!media || derived) return
      const stage = document.querySelector('.stage')
      if (!(stage instanceof HTMLElement)) return
      const step = e.shiftKey ? 0.04 : 0.016
      let next = crop
      if (e.key === 'ArrowLeft') next = { ...crop, cx: crop.cx - step }
      else if (e.key === 'ArrowRight') next = { ...crop, cx: crop.cx + step }
      else if (e.key === 'ArrowUp') next = { ...crop, cy: crop.cy - step }
      else if (e.key === 'ArrowDown') next = { ...crop, cy: crop.cy + step }
      else return
      e.preventDefault()
      setCrop(clampCrop(next, stage.clientWidth, stage.clientHeight))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [crop, derived, media, resnap])

  const onFile = useCallback(
    (file: File | undefined) => {
      if (file && file.type.startsWith('image/')) void adoptStill(file)
    },
    [adoptStill],
  )

  const showGate = !media
  const canSnap = Boolean(media) && !derived && !busy

  return (
    <div
      className={`app${flash ? ' is-flash' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
    >
      <Viewfinder
        ref={finder}
        media={media}
        crop={crop}
        onCrop={setCrop}
        onDropFile={(file) => onFile(file)}
        dragging={dragging}
        onDragging={setDragging}
        interactive={Boolean(media) && !derived}
      />

      <header className="mast">
        <h1>camseed</h1>
        <p>light → sha256 → system-program PDA. not a wallet.</p>
      </header>

      {showGate && (
        <Gate
          denied={denied}
          busy={busy}
          onOpen={() => void openShutter()}
          onPick={() => fileRef.current?.click()}
        />
      )}

      {derived && (
        <AddressPlate
          derived={derived}
          copied={copied}
          onCopy={() => void onCopy()}
          onResnap={resnap}
          onWipe={wipe}
          peek={peek}
          peeking={peeking}
          onPeek={() => void runPeek(derived.address)}
        />
      )}

      {!showGate && !derived && (
        <footer className="bar">
          {canSnap && (
            <button type="button" className="shutter" onClick={() => void snap()} aria-label="freeze">
              <span>freeze</span>
            </button>
          )}
          <div className="bar-side">
            <button type="button" onClick={() => fileRef.current?.click()}>
              still
            </button>
            {media?.kind === 'live' && !derived && (
              <button type="button" onClick={wipe}>
                close
              </button>
            )}
            {error && <p className="err">{error}</p>}
          </div>
        </footer>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
