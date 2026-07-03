import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cobrix Pay',
    short_name: 'Cobrix',
    start_url: '/login',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#151a2d',
    icons: [
      {
        src: '/branding/cobrix-logo.png',
        sizes: '1350x300',
        type: 'image/png',
      },
    ],
  }
}
