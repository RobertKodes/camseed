# camseed

Point the glass (or drop a still). Hash the framed light. Out comes a Solana address.

Not a wallet. Not an explorer skin. Sibling to [drawseed](https://github.com/RobertKodes/drawseed) — ink there, camera here.

Live: https://robertkodes.github.io/camseed/

If that 404s, `gh-pages` is already pushed (`dist/` + `.nojekyll` at the branch root). In the repo settings: **Pages → Deploy from branch `gh-pages`, folder `/` (root)**.

## Loop

1. Full-bleed viewfinder. Camera stays off until you tap **open the shutter**. Denied? Drop a still or pick a file.
2. Nudge the ground-glass square (drag, or arrows). That crop is the only region that counts.
3. **freeze** downsamples the crop to 32×32 RGB (128px work canvas, box-averaged). SHA-256 of those bytes. `PublicKey.findProgramAddressSync` with namespace seed `camseed` against the **System Program** (`11111111111111111111111111111111`). Real base58 PDA.
4. Address plate under the frame: full address, copy (clipboard, textarea fallback), hash crumb, bump. Same pixels → same address. Move the square → different address.
5. Optional `getAccountInfo` on a public RPC (`VITE_RPC_URL` first, then mainnet-beta / publicnode). 403/429 hops. Offline or shrugged RPC leaves the address on the plate. Empty accounts are the usual case. Don't send lamports at a window.

## Design tokens

Darkroom / contact-sheet / optical bench. One safelight, no neon.

| token | hex | job |
| --- | --- | --- |
| `hypo` | `#12100e` | room, well |
| `iodide` | `#3a3228` | plate ink |
| `silver` | `#8f8676` | ground glass, hairlines |
| `gelatin` | `#e4d8c4` | address plate |
| `safelight` | `#c45a2a` | shutter, reticle ticks |
| `fixer` | `#6b2e22` | stain / kicker |

Type: **Fraunces** (optical italic) + **IBM Plex Mono** (stamped address). Fallbacks are Palatino / Courier New — not Inter, not Roboto, not system-ui-only.

## Dev

```bash
npm i
npm run dev
```

App lives at `/camseed/` (GitHub Pages project path). Production check: `npm run build && npm run preview`. Tests: `npm test`.

Optional RPC:

```bash
# .env
VITE_RPC_URL=https://api.mainnet-beta.solana.com
```

## Pages

`base` is `/camseed/`. After `npm run build`, static `dist/` plus `.nojekyll` (and a copied `404.html`) is what gets force-pushed to `gh-pages`:

```bash
npm run pages
```

No Actions required. Flip the Pages source to that branch / root if the live URL 404s.

## What this refuses

No wallet connect, no signing, no seed phrases, no trading. The hash is a preview seed for a PDA lookup, not a keypair.
