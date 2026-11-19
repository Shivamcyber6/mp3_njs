import type { NextConfig } from 'next';

// Fully static: the whole app runs in the browser, so it deploys to any static host (Vercel, GitHub Pages, …).
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
