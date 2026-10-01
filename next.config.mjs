/** @type {import('next').NextConfig} */
export default {
  output: 'standalone',
  reactStrictMode: true,
  // Chromium terlalu besar untuk ikut dibundel; biarkan dimuat saat berjalan.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    // Pembuat PDF membaca gaya dan kop yang sama dengan yang dipakai layar,
    // supaya hasil unduhan tidak menyimpang dari pratinjau.
    '/api/pks/[id]/pdf': ['./app/globals.css', './public/kop-pks.png'],
  },
};
