// Pratinjau tata letak ponsel.
//
// Perender pratinjau tidak mengecil mengikuti viewport, sehingga aturan
// @media (max-width) tidak pernah menyala di sana. Berkas ini menyalin isi
// blok ≤860px dan ≤720px menjadi aturan tanpa syarat, lalu membungkus halaman
// dalam kotak selebar ponsel — jadi yang terlihat memang tata letak sempitnya.
//
//   node uji/pratinjau-ponsel.mjs && buka _ponsel.html
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');

/** Mengambil isi setiap blok @media dengan lebar maksimum <= batas. */
function blokSempit(batas) {
  const keluar = [];
  const pola = /@media screen and \(max-width:(\d+)px\)\{/g;
  let m;
  while ((m = pola.exec(css))) {
    if (Number(m[1]) > batas) continue;
    let i = pola.lastIndex, dalam = 1;
    while (i < css.length && dalam > 0) {
      if (css[i] === '{') dalam++;
      else if (css[i] === '}') dalam--;
      i++;
    }
    keluar.push(css.slice(pola.lastIndex, i - 1));
  }
  return keluar.join('\n');
}

const isi = readFileSync('_dasbor-terang.html', 'utf8');
const badan = isi.slice(isi.indexOf('<body>') + 6, isi.lastIndexOf('</body>'));

const menu = ['Dashboard', 'Analytics', 'Sekolah', 'Daftar PO (Pre-Order)', 'Antrean Verifikasi',
  'Penerbitan Surat', 'Perjanjian (PKS)', 'Kelola Pengguna'];

const halaman = (terbuka) => `
<div class="kerangka">
  <div class="bar-ponsel">
    <div class="bar-judul"><p class="eyebrow" style="margin:0">Skolla</p>
      <strong>Kerjasama Sekolah</strong></div>
    <button class="burger" aria-expanded="${terbuka}">
      <svg viewBox="0 0 24 24"><path d="${terbuka ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}"/></svg>
      ${terbuka ? 'Tutup' : 'Menu'}</button>
  </div>
  ${terbuka ? '<div class="tirai"></div>' : ''}
  <aside class="sisi${terbuka ? ' terbuka' : ''}">
    <div class="sisi-kepala"><p class="eyebrow" style="margin:0">Skolla</p>
      <strong>Kerjasama Sekolah</strong></div>
    <nav class="menu">${menu.map((m, i) =>
      `<a class="menu-item" href="#"${i === 0 ? ' aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/></svg>${m}</a>`).join('')}</nav>
    <div class="sisi-kaki">
      <div class="sisi-akun"><strong>Rizki</strong><span>Head of Operations · Sales · Finance</span></div>
      <div class="baris-kanan"><span class="preset">Tema</span><span class="preset">Keluar</span></div>
    </div>
  </aside>
  <div class="isi">${badan}</div>
</div>`;

// Dua berkas terpisah: panel yang dibuka memakai position:fixed, yang mengacu
// ke viewport — dua tiruan ponsel berdampingan dalam satu halaman membuat
// panelnya menutupi keduanya sekaligus dan tidak menggambarkan keadaan nyata.
for (const [nama, terbuka] of [['tutup', false], ['buka', true]]) {
  writeFileSync(`_ponsel-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ponsel — menu ${nama}</title>
<style>${css}
/* Aturan layar sempit dipaksa menyala; perender pratinjau tidak mengecil
   mengikuti viewport sehingga @media (max-width) tidak pernah nyala di sana. */
${blokSempit(860)}
</style>
<body>${halaman(terbuka)}</body></html>`);
}
console.log('_ponsel-tutup.html dan _ponsel-buka.html ditulis');
