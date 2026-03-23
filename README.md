# Press for Goblins

definitely not three goblins in a trenchcoat

**Live site:** https://pressforgoblins.com
**GitHub:** https://github.com/illillillillli/pressforgoblins

---

## Structure

```
/
├── index.html        ← main page (built from sections/)
├── 404.html          ← custom 404 page
├── style.css         ← all styles + design tokens
├── CNAME             ← custom domain for GitHub Pages
├── robots.txt        ← crawler rules (archival bots blocked)
├── sitemap.xml       ← sitemap
├── assets/           ← images, icons, audio
├── fonts/            ← PressStart2P + Aptos family
├── sections/         ← HTML component partials
│   ├── _vars.html       design system variables
│   ├── _intro.html      hero: eyes, header, copy, CTA
│   ├── _terminal.html   chat engine
│   ├── _receipt.html    post-submit screen
│   └── _404.html        404 overlay
├── qr/               ← QR code landing page
├── _archive/         ← old versions (not deployed)
└── _reference/       ← Claude context + brand rules (not deployed)
```

---

## Brand rules (void philosophy)

- background: `#000` always
- no borders, outlines, dividers, or lines — ever
- no border-radius except chat bubbles
- green: `#7bbf7b`
- fonts: PressStart2P (header + send btn only), Courier New everything else
- tone: dry, cynical, seen-it-all — never cartoonish

---

## Deployment

Hosted on GitHub Pages. Before pushing:
1. flip `robots.txt` noindex → index (remove archive bot blocks if going live)
2. verify formspree `mblndezr` is active
3. push to `main` — GitHub Pages deploys automatically
