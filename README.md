# press for goblins
definitely not three goblins in a trenchcoat

https://pressforgoblins.com
https://github.com/illillillillli/pressforgoblins

structure
```
/
├── index.html        ← home
├── 404.html          ← 404
├── CNAME             ← custom domain for github pages
├── robots.txt        ← crawler rules (archival bots blocked)
├── sitemap.xml       ← sitemap
├── vercel.json       ← vercel config
├── ascii-art.txt     ← ascii art
├── assets/           ← images, icons, audio
├── fonts/            ← PressStart2P + courier new
├── api/              ← serverless functions
└── qr/               ← qr code
```

void philosophy
background: #000
accent: #7bbf7b
minimal use of borders, dividers and outlines
fonts: PressStart2P and Courier New

deployment
hosted on github pages. before pushing:
1.    flip robots.txt noindex → index (remove archive bot blocks if going live)
2.    verify formspree mblndezr is active
3.    push to main - github pages deploys automatically
