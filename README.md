# Tempo: a music player that runs in your browser

Tempo is a fast, private MP3 player built with Next.js. Drop in your own music, build playlists and play
them with keyboard shortcuts. Nothing is uploaded anywhere: files, playlists and likes live in your
browser (IndexedDB and localStorage), so the whole app is a static site with no backend to run or pay for.

## Features

- **Your own music:** add MP3, M4A, FLAC, WAV or OGG files with the button or by dragging them onto the page.
  Title, artist, album, genre, BPM and cover art are read from the file's tags in the browser.
- **Playlists:** create, rename, reorder and delete them, add tracks from any row's ⋯ menu, and like tracks.
- **Full playback controls:** shuffle, repeat (all / one), play next, seek, volume and mute.
- **Resumes where you left off:** the last track, position, queue, volume and modes are restored after a reload.
- **Live visualizer:** frequency bars drawn from the audio with the Web Audio API.
- **System media controls:** lock screen, headphone buttons and media keys work via the Media Session API.
- **Keyboard first:** press `?` in the app for the full list.

  | Key | Action |
  | --- | --- |
  | `Space` | Play / pause |
  | `←` `→` | Seek 5 s |
  | `Shift` + `←` / `→` | Previous / next track |
  | `M` `S` `R` | Mute, shuffle, repeat |
  | `/` | Search |
  | `J` `K` / `↑` `↓`, `Enter` | Move through the list, play |

- **Search** across title, artist, album and genre, with matches highlighted.
- **Responsive:** sidebar and now-playing panel on desktop; drawer, mini player and full-screen player on phones.
- **Light and dark themes** that follow your system setting.

## Tech

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 · Web Audio API ·
Media Session API · IndexedDB (`idb-keyval`) · `music-metadata`

```
app/                 layout, page, PWA manifest
components/          App shell, Sidebar, TrackView, PlayerBar, NowPlaying, Visualizer, …
lib/library.tsx      tracks, playlists and likes; uploads stored in IndexedDB
lib/player.tsx       playback engine: queue, shuffle/repeat, persistence, media session, shortcuts
lib/demo-tracks.ts   the bundled demo tracks
scripts/             make-demo-tracks.py, which synthesizes the demo MP3s
```

## Demo tracks

The six demo tracks in `public/tracks/` are original pieces that `scripts/make-demo-tracks.py` synthesizes
from scratch with numpy (no samples), so they're free to ship. Regenerate them with `npm run tracks`
(needs Python 3, numpy and ffmpeg).

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run build` writes the static site to `out/`.

## Deploy

On Vercel, import the repository; Next.js is detected and no settings or environment variables are needed.
Because the build is fully static, `out/` can also be hosted on GitHub Pages, Netlify or any file server.

## Credits

Started from Lee Robinson's open-source [next-music-player](https://github.com/leerob/next-music-player),
then rebuilt to run without a database or server: a new client-side data layer, player engine, UI,
uploads, playlists, visualizer and demo tracks.
