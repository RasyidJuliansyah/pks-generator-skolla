import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kerjasama Sekolah | Skolla',
  description: 'Dari Form Pre Order sampai layanan berjalan.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Skrip di bawah menyetel data-theme SEBELUM React menghidrasi, jadi DOM selalu
    // punya atribut yang tidak ada di HTML kiriman server. Tanpa penanda ini React
    // mengadukannya sebagai ketidakcocokan hidrasi di setiap halaman. Cakupannya satu
    // tingkat: atribut <html> sendiri, sedangkan anak-anaknya tetap diperiksa.
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@300..700&display=swap"
        />
        {/* Dijalankan sebelum render supaya tema tidak berkedip saat memuat.
            Bawaannya terang; gelap hanya bila pengguna memilihnya sendiri. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('tema');" +
              "document.documentElement.dataset.theme=(t==='dark')?'dark':'light'}catch(e){" +
              "document.documentElement.dataset.theme='light'}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
