# Davlat bayrog‘i — 35 yilligi · 3D anniversary animation

A 14-second (420 frames @ 30 fps) cinematic 3D motion piece for **Termez State University** marking the
anniversary of the adoption of the State Flag of the Republic of Uzbekistan (Law No. 407-XII, 18 Nov 1991).

Built with **Remotion 4 + React Three Fiber** (`@remotion/three`, `three`, `@react-three/drei`, `postprocessing`).
Everything is driven by `useCurrentFrame()` and a seeded PRNG, so re-renders are bit-identical.

## Outputs (`out/`)

| File | Spec |
|---|---|
| `flagday_9x16.mp4` | 1080×1920, H.264, yuv420p, 30 fps, CRF 16 — Reels / Stories |
| `flagday_1x1.mp4` | 1080×1080, same settings — feed |
| `flagday_loop.gif` | target 540×540 @ 15 fps; with grain it exceeded 10 MB, so the script fell back to **480×480 @ 12 fps (9.97 MB)**; grain denoised for the GIF only |
| `poster.png` | final badge frame, 1080×1920, lossless |
| `flag_texture_check.png` | the exact flat flag (4000×2000) produced by `drawFlag()` |

A 4:5 (1080×1350) composition also exists: `npm run render:4x5`.

The MP4s are large (9:16 ≈ 138 MB, 1:1 ≈ 84 MB) because film grain is costly at CRF 16, so they are not committed
(GitHub rejects files > 100 MB). For a lighter share copy: `ffmpeg -i out/flagday_9x16.mp4 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p out/flagday_9x16_share.mp4`.
Render time in software GL on a 4-core machine: ≈ 35 min (9:16) and ≈ 25 min (1:1) at concurrency 3.

## Quick start

```bash
npm install
npm run test:flag            # asserts flag colours at stripe centres, stars, crescent edges → out/flag_texture_check.png
npm run stills -- FlagDay 30,90,150,210,270,330,410 0.5   # QA stills → out/stills/
npm run render:all           # 9:16 + 1:1 + GIF + poster + verification
npm run studio               # interactive preview
```

Rendering uses software WebGL (`swangle`, see `remotion.config.ts`) so it works headless on any machine.
On a Windows/macOS machine with a GPU, change `Config.setChromiumOpenGlRenderer('swangle')` to `'angle'` for much faster renders.
If Remotion cannot download its headless Chrome, point it to a local one: `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:9x16`.

## Change the year

All text derives from `year` (`YEARS = year − 1991`): big number, lower third, badge ring.

* Default: `src/config.ts → defaultProps.year` (2026 → **35**).
* Per render without editing code: `npx remotion render src/index.ts FlagDay out/x.mp4 --props='{"year":2031,"width":1080,"height":1920}'`.

The 3D numerals are generated from the font at render time, and the ribbon traces whatever digits the year produces.

## Swap the logo / model

* **Logo**: replace `assets/logo_terdu.png` (transparent PNG). `npm run sync` (run automatically by every render script) copies it
  byte-for-byte into `public/`. It is only uniformly scaled, faded and placed — never recoloured, cropped or tone-mapped
  (unlit material, `toneMapped: false`, billboarded to the camera so it is never skewed).
* **Humo model**: the sculpture is procedural (`src/three/Humo.tsx`). Drop a model at `assets/humo.glb` and it is used automatically
  instead (`src/three/GlbHumo.tsx`: normalised to ~8.6 units tall, base on the floor, its own materials kept, finale dissolve applied).
  Note: wing-ring–dependent placements (logo halo, ribbon helix) are tuned for the procedural proportions and may need adjusting
  in `Humo.tsx` (`RING_C`) / `ribbonPath.ts` (`HELIX`). This path was smoke-tested with a generated placeholder box model (no real model was supplied).

## Where things live

| Concern | File |
|---|---|
| Flag geometry & colours (single source of truth, per Law 407-XII art. 4) | `src/flag/flagSpec.ts` |
| Flag drawing (exact flag + stripe-only pattern for decorations) | `src/flag/drawFlag.ts`, `src/flag/makeFlagTexture.ts` |
| All easing curves ("After Effects flow": fast start, soft settle, critically-damped springs) | `src/motion.ts` |
| Scene timing | `src/timeline.ts` |
| Text & year logic | `src/config.ts` |
| Camera (dolly + gentle orbit, per-aspect framing) | `src/three/camera.ts` |
| Sky (gradient + 3 parallax fbm cloud layers) | `src/three/Sky.tsx` |
| Humo sculpture + pedestal | `src/three/Humo.tsx` |
| Ribbon path (entrance → one-turn helix → traces the digit outlines) | `src/three/ribbonPath.ts`, `src/three/Ribbon.tsx` |
| Gold 3D letters (reveal follows the ribbon) | `src/three/glyphs.ts`, `src/three/Letters.tsx` |
| Logo halo, streaks/particles, badge | `src/three/Logo.tsx`, `Streaks.tsx`, `Badge.tsx` |
| Post (DOF, bloom, CA, edge blur, vignette, seeded grain) | `src/three/PostFX.tsx` |
| Lower third + finale particle stream (2D) | `src/overlay/LowerThird.tsx` |

## Fonts

Both fonts are SIL OFL Google Fonts, bundled as static TTFs in `public/fonts/` (licences alongside) — no network at render time.

* **Display / 3D letters: Playfair Display ExtraBold (800)** — high-contrast serif that reads as engraved metal when extruded and
  bevelled. Converted to a three.js typeface (`npm run typeface`) using its **lining figures** (`lnum`) so the number sits on the baseline.
* **Text: Montserrat SemiBold (600)** — clean geometric sans, very legible on mobile.
* Coverage was checked with `npm run fonts:check` (fontTools): both contain U+02BB ʻ, U+2018 ‘, U+02BC ʼ, O, G, digits and “·”.
  Manrope was rejected because it lacks U+02BB. The text uses the proper Uzbek letter **ʻ (U+02BB)** in Oʻzbekiston / bayrogʻi.
* Static instances were made from the variable fonts with `fonttools varLib.instancer --remove-overlaps` (overlapping contours would break extrusion).

## Approximations & limitations (please read)

* **Humo sculpture is a procedural stylisation** modelled after the supplied reference photo (wings rising into an almost closed ring of
  openwork feathers, small crested head facing right, lattice spindle body in a lens-shaped bronze frame, flared panels with tile borders).
  It is not a scan and not dimensionally accurate. It is rendered in polished gold (per brief), whereas the real monument's wings are steel;
  the pedestal is dark stone (per brief) rather than the real light stone. The tile-border pattern is an original geometric motif.
* **Flag colours**: the law names no exact hues; `#0099B5 / #FFFFFF / #1EB53A / #CE1126` are used and can be swapped in `flagSpec.ts`.
* **Crescent inner arc**: the law does not define it; the cut-out circle (centre 40, 20; r 15) is a fixed approximation.
* In the final grade, values above 0.95 get a soft highlight knee (so gold highlights don't clip harshly); this lowers pure flag white
  by ≈1–2 % on screen. Vignette, grain and H.264/yuv420p chroma subsampling also slightly affect on-screen colour. The flat
  `flag_texture_check.png` is exact.
* The specular sweep on the badge briefly brightens part of the flag (requested effect); the badge's soft glow may extend into the bottom 15 %.
* The GIF loops the full piece; the cut from the final badge back to the dark opening is a hard loop point.
