import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Centro de Control | Cobrix Pay',
  description: 'Centro interno de seguimiento para Cobrix Pay.',
  manifest: '/control-manifest.webmanifest',
  themeColor: '#151a2d',
  appleWebApp: {
    capable: true,
    title: 'Centro de Control',
    statusBarStyle: 'black-translucent',
  },
}

export default function ControlLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
