// Pratinjau isian Nilai sponsorship di tiga keadaan, dua tema, lebar lebar dan sempit.
//
//   node uji/pratinjau-sponsorship.mjs && node uji/tangkap-layar.mjs _sponsorship-terang.html _sponsorship-gelap.html
//
// Isian ini memakai token yang sudah ada (.f.lebar, .meta, .lencana.kuning), jadi yang
// diperiksa di sini bukan warnanya melainkan susunannya: apakah bantuan, batas, dan kotak
// peringatan tetap terbaca dan tidak saling tindih saat lebarnya 375px.
//
// Aturan yang sudah menggigit sebelumnya dan dijaga di sini: @media WAJIB pakai `screen and`
// (tanpa itu aturan layar sempit ikut berlaku saat mencetak, dan A4 cuma 794px).
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');
const rp = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(n);

const isian = (judul, nilai, batas, lebih, adaCatatan = true) => `
<section class="kotak" style="margin-bottom:18px">
  <div class="panel-head"><h2>${judul}</h2><span class="hint">langkah Penanda Tangan &amp; Catatan</span></div>
  <div class="isian">
    <div class="f lebar">
      <label for="c2-${judul.length}">Catatan 2: Sponsorship</label>
      <textarea id="c2-${judul.length}" rows="2">${adaCatatan ? 'Spanduk, seragam, dan konten media sosial' : ''}</textarea>
    </div>
    <div class="f lebar">
      <label for="sp-${judul.length}">Nilai sponsorship (Rp)</label>
      <input id="sp-${judul.length}" type="number" value="${nilai}">
      <span class="meta">Total nilai, termasuk barang dan media dengan harga pokoknya bagi Skolla. Batas 15%: ${rp(batas)}.</span>
      ${lebih === 'lebih' ? '<span class="lencana kuning">Di atas 15% dari total. PO ini akan diverifikasi manual.</span>' : ''}
      ${(nilai > 0 || adaCatatan)
        ? '<span class="lencana kuning">Perlu konfirmasi Finance sebelum PKS diunggah</span>'
        : ''}
    </div>
  </div>
</section>`;

const PERNYATAAN = [
  'Form Sponsorship atau Form Hibah beserta Berita Acaranya sudah ditandatangani',
  'Rekening penerima atas nama sekolah, yayasan, atau badan hukum, bukan perorangan',
  'Hibah di atas Rp5.000.000 memakai meterai Rp10.000 pada Berita Acaranya',
];

/** Kotak Dokumen Sponsorship di halaman PKS, ketiga keadaannya. */
const kotak = (lencana, kelas, { centang, mati = false, basi = null, kaki = '' }) => `
<section class="kotak" style="margin-bottom:18px">
  <div class="panel-head"><h2>Dokumen Sponsorship</h2><span class="lencana ${kelas}">${lencana}</span></div>
  <div style="padding:12px 16px">
    ${basi ? `<p class="meta" style="margin-top:0">${basi}</p>` : ''}
    ${PERNYATAAN.map((t, i) => `<label class="baris" style="padding:8px 0;min-height:44px">
      <input type="checkbox"${centang[i] ? ' checked' : ''}${mati ? ' disabled' : ''}>
      <span><span class="nama">${t}</span></span></label>`).join('')}
    ${mati ? '' : '<button class="tombol" style="margin-top:10px;min-height:44px">Simpan konfirmasi</button>'}
    ${kaki ? `<p class="meta" style="margin-bottom:0">${kaki}</p>` : ''}
  </div>
</section>`;

const halaman = (tema) => `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nilai sponsorship — ${tema}</title><style>${css}</style>
<body><div class="wrap">
  <p class="eyebrow">Isian nilai sponsorship — tema ${tema}</p>
  ${isian('Dalam batas', 4860000, 4860000, 'biasa')}
  ${isian('Di atas batas', 6000000, 4860000, 'lebih')}
  ${isian('Catatan kosong, nilai terisi', 1000000, 4860000, 'kosong')}
  ${isian('Catatan terisi, nilai belum', 0, 4860000, 'biasa')}
  ${isian('Belum diisi sama sekali', 0, 4860000, 'kosong', false)}
  <p class="eyebrow">Pemberitahuan di halaman PO — tema ${tema}</p>
  <div class="pesan kuning" style="margin:16px 0">
    <span class="lencana kuning">Sponsorship</span> Sebelum PKS bermeterai bisa diunggah,
    <strong>Finance</strong> harus mengonfirmasi dokumen sponsorship-nya.
    <a href="#">Buka halaman PKS</a>.
  </div>
  <p class="eyebrow">Kotak Dokumen Sponsorship — tema ${tema}</p>
  ${kotak('Sudah dikonfirmasi', 'hijau', { centang: [1, 1, 1], kaki: 'Terakhir disimpan farid · 20 Sep 2026, 21.40' })}
  ${kotak('Belum dikonfirmasi', 'kuning', { centang: [1, 1, 0],
    basi: 'PO ini berubah sesudah dikonfirmasi (konfirmasi untuk versi 1, sekarang versi 2). Konfirmasinya perlu diulang.' })}
  ${kotak('Belum lengkap', 'kuning', { centang: [1, 1, 0], mati: true,
    kaki: 'Hanya Finance yang bisa mengisi bagian ini.' })}
</div></body></html>`;

for (const tema of ['light', 'dark']) {
  writeFileSync(`_sponsorship-${tema === 'light' ? 'terang' : 'gelap'}.html`, halaman(tema));
}
console.log('_sponsorship-terang.html dan _sponsorship-gelap.html ditulis');
