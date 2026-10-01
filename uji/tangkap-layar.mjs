// Memotret berkas pratinjau dengan Chrome lokal, supaya tata letaknya benar-benar
// dilihat sebelum dikirim — bukan dibayangkan.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-sekolah.tsx
//   node uji/tangkap-layar.mjs _sekolah-terang.html _sekolah-gelap.html
//
// Ada sebabnya perkakas ini dibuat: halaman sekolah pernah tayang dengan kartu
// KPI yang label dan angkanya menempel sebaris, dan tautan PO yang di tema gelap
// cuma 2,08:1 karena tidak ada aturan warna untuk `a` sama sekali. Keduanya
// ketahuan dalam hitungan detik begitu benar-benar dipandang.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const berkas = process.argv.slice(2);
// LEBAR=375 untuk memotret ukuran ponsel; berkasnya diberi akhiran -375.
const LEBAR = Number(process.env.LEBAR ?? 1200);
if (!berkas.length) {
  console.error('pakai: node uji/tangkap-layar.mjs <berkas.html> [...]');
  process.exit(1);
}
if (!existsSync(CHROME)) {
  console.error(`Chrome tidak ditemukan di ${CHROME}. Setel CHROME=<jalur> bila lain.`);
  process.exit(1);
}

const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
for (const f of berkas) {
  const p = await b.newPage();
  await p.setViewport({ width: LEBAR, height: 1400, deviceScaleFactor: 2 });
  await p.goto(`file://${process.cwd()}/${f}`, { waitUntil: 'load' });
  // Bagian yang terlipat ikut dibuka: yang tidak terlihat tidak terperiksa.
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  const keluar = f.replace(/\.html$/, LEBAR === 1200 ? '.png' : `-${LEBAR}.png`);
  await p.screenshot({ path: keluar, fullPage: true });
  console.log(`  ${keluar}`);
}
await b.close();
