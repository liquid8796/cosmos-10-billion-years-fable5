# 10 Billion Years

**Version 1.1.0** · an interactive, scroll-driven, sound-designed journey through the life and death of a star — ending on the word *you.*

One particle field with eight destinies. As you scroll, ~42,000 GPU-morphed particles travel from a cold hydrogen cloud through gravitational collapse, a wheeling spiral galaxy, ignition, a red giant, the last fire, a supernova detonation — and finally drift back together to spell **"you."** A fully procedural WebAudio score (no audio files) evolves with every chapter and detonates with the star.

---

## Quick start

**Zero-install:** double-click `dist/10-billion-years.standalone.html` — a single self-contained file (engine + Three.js inlined).

**From source (recommended for development):**

```bash
npm start          # serves the project at http://localhost:4173 (uses npx serve)
```

or serve the folder with any static server. No dependencies, no build step required to run from source.

```bash
npm run build      # regenerates dist/10-billion-years.standalone.html
```

Everything except the (gracefully degrading) Google Fonts link works fully offline — Three.js r128 is vendored in `vendor/`.

---

## Deploy to Vercel

The project is deploy-ready with zero dashboard configuration.

**CLI (fastest):**

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

**Git integration:** push the repo and *Import Project* on vercel.com — the framework preset resolves to **Other**, and `vercel.json` handles everything else. No build command, install command, or output directory needs to be set.

What the deployment config does:

- **No build step** — a no-op `vercel-build` script guarantees the platform never runs the standalone bundler; the site deploys as pure static files from the repo root. `.vercelignore` keeps `scripts/`, `dist/`, archives and logs out of the upload.
- **Cache strategy** — HTML is `max-age=0, must-revalidate` so releases propagate instantly; `/css/*`, `/js/*` and `/vendor/*` are `immutable` for one year. That is safe because app assets carry version-stamped URLs (`?v=1.1.0`) and the vendored Three.js is revision-named (`three-r128.min.js`) — every release changes the URLs, never the cached bytes.
- **Security headers** — a strict Content-Security-Policy (self-hosted scripts only, Google Fonts allow-listed, no objects, `frame-ancestors *` so showcases may embed it), `nosniff`, referrer and permissions policies.
- **Clean URLs + SPA fallback** — `cleanUrls` drops `.html`, and unknown paths rewrite to the experience instead of a 404.

**Release ritual:** bump the version in `package.json`, `APP_VERSION` in `js/app.js`, the `?v=` stamps in `index.html`, and add a `CHANGELOG.md` entry — the immutable caches bust automatically.

---

## The journey

| # | Chapter | Years elapsed | Particle formation |
|---|---------|--------------:|--------------------|
| 01 | The cloud | 0 | Clumped molecular nebula with cold outer haze |
| 02 | The collapse | ~400,000 | Infall filaments spiraling into a dense core |
| 03 | A galaxy | ~2,000,000 | Two-arm logarithmic spiral, bulge + thin disk |
| 04 | First light | ~50,000,000 | Newborn core, accretion ring, blown-back shell |
| 05 | The swelling | ~9.2 billion | Vast convective red-giant envelope with granulation |
| 06 | The last fire | ~9.99 billion | Onion-shell burning layers around an iron heart |
| 07 | Supernova | 10 billion | Neutron-star remnant, blast shell, ejecta filaments |
| 08 | you. | now | Stardust condenses into the word itself |

The year counter in the top-right interpolates non-linearly between these checkpoints and resolves to **"now"** for the finale.

## Controls

- **Scroll** (wheel / touch / keyboard) — travel through time. The timeline is eased, so motion stays buttery at any scroll speed.
- **Mouse / touch drag** — the particle field repels and vortexes around your pointer; fast movement pushes harder and brightens the stellar-wind shimmer in the score. When idle, an autopilot hand keeps the field alive.
- **Right-side rail** — click a pip to jump to any chapter (hidden below 680px width).
- **`M` or the top-left button** — mute/unmute.
- **Travel again ↺** — restart from the finale.

## Sound design (100% synthesized, zero assets)

- **Deep-space drone** — three detuned oscillators through a lowpass whose cutoff and pitch track the timeline (rising through the collapse, blooming at first light, sagging as the fuel runs out).
- **Stellar wind** — looped noise through a wandering bandpass; responds to pointer speed.
- **Ignition chime** — two decaying sine partials when fusion begins.
- **Supernova** — filtered noise shockwave + exponential sub-drop (110→26 Hz) + high crack, fed through a feedback-delay "cosmic echo," with the drone side-chain ducking in awe.
- **you.** — a warm detuned pad rises, and a soft 52 Hz heartbeat begins.

Audio starts only after an explicit user gesture (the intro's *Begin with sound*), satisfying every autoplay policy. The context suspends when the tab is hidden.

## Architecture

```
10-billion-years/
├── index.html                     # semantic narrative, HUD skeleton, intro overlay
├── css/style.css                  # design tokens, chapter typography, HUD, responsive rules
├── js/app.js                      # the engine (see below)
├── vendor/three-r128.min.js       # Three.js r128, vendored + revision-named for immutable caching
├── scripts/build-standalone.mjs   # inlines css+js into dist/ (Node built-ins only)
├── dist/10-billion-years.standalone.html
├── vercel.json                    # headers, cache policy, clean URLs, SPA fallback
├── .vercelignore                  # trims the deployment upload
├── CHANGELOG.md
├── LICENSE                        # MIT
└── package.json                   # version source of truth · no-op vercel-build
```

**Engine (`js/app.js`) in one paragraph:** eight deterministic Float32Array position sets (one per stage, seeded RNG) are generated at boot; the shader interpolates between the current pair (`position` ↔ `aPosB`) with a CPU-eased morph factor, so buffers are re-uploaded **only when the timeline crosses a keyframe**. The vertex shader adds per-stage differential-vs-rigid rotation (`diff` controls how fast inner material orbits relative to the whole — full vortex for the collapse, near-rigid for the galaxy so the arms never wind into a smear), radial pulse (the dying star's flicker), trig-based turbulence, and pointer repulsion + tangential vortex in world space. Segment 5 uses a custom ease that trembles slowly and then detonates; crossing the threshold fires the boom (audio one-shot, white flash overlay, brightness boost, decaying camera shake). The word *you.* is rasterized from a hidden canvas at boot and sampled into particle targets.

## Configuration

Everything tunable lives at the top of `js/app.js`:

| Knob | Where | Effect |
|------|-------|--------|
| `CONFIG.pages` | app.js | Scroll length in viewport heights (default 10) |
| `CONFIG.keys` | app.js | Timeline position of each stage keyframe |
| `CONFIG.years` | app.js | Year-counter checkpoint per keyframe |
| `CONFIG.boomLocal` | app.js | How deep into segment 5 the detonation fires |
| `pickParticleCount()` | app.js | Adaptive particle budget (16k–42k by device) |
| `STAGES[]` | app.js | Per-stage palette, accent, point size, turbulence, swirl, rigidity, pulse, backdrop tint |
| `CAMERA_KEYS[]` | app.js | Camera position per stage |
| `AUD_STAGE[]` | app.js | Per-stage filter cutoff, drone pitch, shimmer, pad, tremolo |

## Performance & resilience

- Adaptive particle count by `deviceMemory` / viewport; DPR clamped (2 desktop, 1.75 touch).
- Runtime FPS guard: two graduated degradation steps (lower pixel ratio, then draw-range cut) instead of stutter.
- GPU morphing — per-frame CPU work is O(1) in particle count; buffers upload only at keyframe crossings.
- `prefers-reduced-motion`: turbulence, swirl, camera bob and pointer force scaled down; shake and cue animation disabled; instant chapter jumps.
- No WebGL → static nebula-gradient fallback; the full narrative remains readable and scrollable. WebGL context loss handled.
- No `localStorage`/cookies; nothing tracked.

## Accessibility

Semantic sections carry the full story for screen readers; the rail is a labeled `<nav>` of real buttons; all interactive elements have visible `:focus-visible` rings and 44px targets; the mute toggle exposes `aria-pressed`; the intro is a labeled dialog; keyboard scrolls natively and `M` toggles sound.

## Browser support

Evergreen Chrome, Edge, Firefox, Safari (desktop + mobile). Requires WebGL 1 for visuals and Web Audio for sound; both degrade gracefully when absent.

## Verification

Shipped after a headless-Chromium pass (SwiftShader WebGL): zero console errors across all eight stages at 1440×900 and 375×720, spiral-arm persistence confirmed over a 25 s dwell, boom/flash/counter/finale visually inspected via screenshot. The Vercel header set is validated by serving the site locally through an HTTP shim that applies `vercel.json` policy — the strict CSP produces zero violations end-to-end.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Current release: **1.1.0** — Vercel deployment support.

## License

MIT — see [LICENSE](LICENSE).
