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

Any static host works. On Cloudflare Pages: framework preset **None**, build command empty,
output directory `/`. Keep each file under 25 MB (Pages limit) — host the DMG on GitHub Releases or R2.

`_headers` adds caching and security headers on Cloudflare Pages. Its Content-Security-Policy
allows the three inline blocks in `index.html` `<head>` by hash. If you edit any of them,
print the new hashes and paste them into `_headers`:

```sh
python3 -c "import re,hashlib,base64;h=open('index.html').read();[print(base64.b64encode(hashlib.sha256(b.encode()).digest()).decode()) for a,b in re.findall(r'<(?:script|style)([^>]*)>(.*?)</(?:script|style)>',h,re.S) if 'src=' not in a]"
```
