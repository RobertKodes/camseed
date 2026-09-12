import { useEffect, useRef } from 'react'
import type { Derived } from '../lib/derive'
import { shortenAddress } from '../lib/derive'
import { formatSol, type PeekResult } from '../lib/rpc'

type Props = {
  derived: Derived
  copied: boolean
  onCopy: () => void
  onResnap: () => void
  onWipe: () => void
  peek: PeekResult | null
  peeking: boolean
  onPeek: () => void
}

function peekLine(peek: PeekResult | null, peeking: boolean): string {
  if (peeking) return 'checking a public RPC…'
  if (!peek) return 'optional on-chain peek is idle'
  if (!peek.ok) return peek.error
  const hop = peek.hopped.length ? ` · hopped ${peek.hopped.join(', ')}` : ''
  if (peek.empty) {
    return `empty on ${new URL(peek.url).host}${hop} — usual case`
  }
  return `${formatSol(peek.lamports)} SOL · owner ${peek.owner ?? '?'}${hop}`
}

function SampleThumb({ rgb, grid }: { rgb: Uint8Array; grid: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = grid
    canvas.height = grid
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(grid, grid)
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      image.data[j] = rgb[i] ?? 0
      image.data[j + 1] = rgb[i + 1] ?? 0
      image.data[j + 2] = rgb[i + 2] ?? 0
      image.data[j + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }, [rgb, grid])
  return <canvas ref={ref} className="thumb" width={grid} height={grid} aria-hidden />
}

export function AddressPlate({
  derived,
  copied,
  onCopy,
  onResnap,
  onWipe,
  peek,
  peeking,
  onPeek,
}: Props) {
  return (
    <aside className="plate" aria-live="polite">
      <div className="plate-mark">exposure</div>
      <div className="plate-row">
        <SampleThumb rgb={derived.rgb} grid={derived.grid} />
        <div className="plate-addr">
          <div className="address-head">
            <strong className="short">{shortenAddress(derived.address)}</strong>
            <button type="button" className="copy" onClick={onCopy}>
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <code className="full">{derived.address}</code>
          <p className="hash">
            sha256 {derived.hashHex.slice(0, 16)}… · bump {derived.bump} · {derived.grid}² · system
            program PDA
          </p>
        </div>
      </div>
      <div className="plate-actions">
        <button type="button" onClick={onResnap}>
          resnap
        </button>
        <button type="button" onClick={onWipe}>
          wipe
        </button>
        <button type="button" onClick={onPeek} disabled={peeking}>
          peek
        </button>
        <span className="peek-line">{peekLine(peek, peeking)}</span>
      </div>
    </aside>
  )
}
