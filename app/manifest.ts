import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cobrix Pay',
    short_name: 'Cobrix Pay',
    start_url: '/login',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#151a2d',
    icons: [
      {
        src: '/branding/cobrix-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/cobrix-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
