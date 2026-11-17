# Sculpt website

Landing page for [Sculpt](https://github.com/amateuristrying/Sculpt) — local image-to-3D for macOS.

Static site, no build step: `index.html`, `styles.css`, `main.js` (three.js + GSAP from CDN).

## Run locally

```sh
python3 -m http.server 4321
```

Open http://localhost:4321. It must be served over HTTP (ES modules don't load from `file://`).

## Before launch

Everything you edit lives in `config.js`:

- `macDownloadUrl` — point at the versioned DMG once it's published.
- `RESULTS` — replace the built-in "Sample" stand-ins with real Sculpt exports
  (`results/<name>.jpg` + `results/<name>.glb`).

## Deploy

Any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages) — publish the repo root.
