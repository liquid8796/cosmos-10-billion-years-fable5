# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com) · Versioning: [SemVer](https://semver.org)

## [1.1.0] — 2026-07-16

### Added
- Zero-config Vercel deployment: `vercel.json` with clean URLs, an SPA-style fallback rewrite, security headers (strict Content-Security-Policy, `nosniff`, referrer & permissions policies, embeddable via `frame-ancestors *`) and a cache policy of `must-revalidate` HTML plus one-year `immutable` assets.
- `.vercelignore` to keep build tooling, `dist/`, archives and logs out of the deployment upload.
- No-op `vercel-build` script so the platform never runs the standalone bundler.

### Changed
- App asset URLs are version-stamped (`css/style.css?v=1.1.0`, `js/app.js?v=1.1.0`) and the vendored Three.js is revision-named (`vendor/three-r128.min.js`), making the immutable cache policy safe — releases change URLs, never cached bytes.
- Standalone bundler now strips `?v=` query strings when resolving files to inline.
- `noscript` fallback styling moved from an inline attribute into the stylesheet so the CSP needs no inline-style allowances beyond Google Fonts.

## [1.0.0] — 2026-07-16

### Added
- Initial assembly of the "10 Billion Years" interactive experience.
- Scroll-driven 3D particle morph engine (Three.js r128, vendored): eight deterministic stage formations — cloud, collapse, galaxy, first light, red giant, last fire, supernova, "you." — GPU-interpolated with keyframe-only buffer uploads.
- Pointer-reactive field: world-space repulsion + tangential vortex, speed-sensitive force, idle autopilot drift.
- Fully procedural WebAudio score: evolving drone, stellar-wind shimmer, ignition chime, supernova detonation (shockwave + sub-drop + crack + echo + sidechain duck), warm finale pad and 52 Hz heartbeat; explicit-gesture start, mute toggle (`M`), tab-visibility suspend.
- Cinematic camera path with parallax, ambient bob, and decaying post-detonation shake; white-flash overlay and brightness bloom at the boom.
- HUD: non-linear 10-billion-year counter resolving to "now", chapter rail with jump navigation, scroll cue, custom cursor follower, per-chapter backdrop tints and accent re-theming.
- Per-stage rotation rigidity (`diff`) so the galaxy's spiral arms persist instead of winding into a smear.
- Adaptive particle budget (16k–42k), DPR clamp, two-step runtime FPS degradation guard.
- Accessibility & resilience: reduced-motion handling, semantic narrative for screen readers, focus-visible controls, no-WebGL gradient fallback, context-loss handling, noscript message.
- Standalone single-file build (`npm run build` → `dist/10-billion-years.standalone.html`).
