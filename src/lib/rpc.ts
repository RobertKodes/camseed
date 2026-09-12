import { Connection, PublicKey } from '@solana/web3.js'

const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
]

export type PeekOk = {
  ok: true
  url: string
  empty: boolean
  lamports: number
  owner: string | null
  hopped: string[]
}

export type PeekFail = {
  ok: false
  error: string
  hopped: string[]
}

export type PeekResult = PeekOk | PeekFail

function rpcList(): string[] {
  const extra = import.meta.env.VITE_RPC_URL?.trim()
  return [...new Set([extra, ...PUBLIC_RPCS].filter((u): u is string => Boolean(u)))]
}

function statusFromError(err: unknown): number {
  if (!err || typeof err !== 'object') return 0
  const e = err as {
    status?: number
    message?: string
    cause?: { status?: number; message?: string }
  }
  if (typeof e.status === 'number') return e.status
  if (typeof e.cause?.status === 'number') return e.cause.status
  const msg = `${e.message ?? ''} ${e.cause?.message ?? ''}`
  if (/\b403\b/.test(msg)) return 403
  if (/\b429\b/.test(msg)) return 429
  return 0
}

function shouldHop(err: unknown): boolean {
  const status = statusFromError(err)
  return status === 403 || status === 429 || status === 0
}

export async function peekAccount(address: string): Promise<PeekResult> {
  const hopped: string[] = []
  const urls = rpcList()

  for (const url of urls) {
    try {
      const connection = new Connection(url, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      })
      const pubkey = new PublicKey(address)
      const info = await connection.getAccountInfo(pubkey)
      return {
        ok: true,
        url,
        empty: info === null,
        lamports: info?.lamports ?? 0,
        owner: info?.owner.toBase58() ?? null,
        hopped,
      }
    } catch (err) {
      const status = statusFromError(err)
      const label = status ? `${status}` : 'network'
      hopped.push(`${new URL(url).host} ${label}`)
      if (shouldHop(err)) continue
    }
  }

  return {
    ok: false,
    error: hopped.length
      ? `rpc shrugged (${hopped.join(' → ')}) — address still stands`
      : 'no RPC urls to try',
    hopped,
  }
}

export function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(lamports === 0 ? 0 : 4)
}
