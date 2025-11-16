import './globals.css'

export const metadata = {
  title: 'FM Trafik CRM',
  description: 'Teklif ve Satış Yönetim Sistemi',
}

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
