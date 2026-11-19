import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tempo · Music Player',
    short_name: 'Tempo',
    description: 'A private music player that runs in your browser.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b0d',
    theme_color: '#0b0b0d',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
