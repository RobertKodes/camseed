import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { GRID } from './pixels'

/** Well-known program id: System Program. Documented constant, not a secret. */
export const PROGRAM_ID = SystemProgram.programId
export const PROGRAM_ID_BASE58 = PROGRAM_ID.toBase58()

/** First PDA seed so this lab's addresses don't collide with a bare hash. */
export const SEED_NAMESPACE = 'camseed'

export type Derived = {
  rgb: Uint8Array
  hashHex: string
  hashBytes: Uint8Array
  address: string
  bump: number
  programId: string
  grid: number
}

export async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return new Uint8Array(digest)
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function pdaFromHash(hashBytes: Uint8Array): { address: string; bump: number } {
  if (hashBytes.length !== 32) {
    throw new Error(`hash must be 32 bytes, got ${hashBytes.length}`)
  }
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_NAMESPACE), Buffer.from(hashBytes)],
    PROGRAM_ID,
  )
  return { address: pda.toBase58(), bump }
}

export async function deriveFromRgb(rgb: Uint8Array): Promise<Derived> {
  const hashBytes = await sha256Bytes(rgb)
  const { address, bump } = pdaFromHash(hashBytes)
  return {
    rgb,
    hashHex: bytesToHex(hashBytes),
    hashBytes,
    address,
    bump,
    programId: PROGRAM_ID_BASE58,
    grid: GRID,
  }
}

export function shortenAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}
