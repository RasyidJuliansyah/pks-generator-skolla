// Memindai chunk klien hasil build untuk angka yang HANYA ada di tier Acquisition.
//
// OTOMATIS sejak 20 Sep 2026: terdaftar sebagai `postbuild` di package.json, jadi npm
// menjalankannya sesudah SETIAP `npm run build` — termasuk build Vercel, yang memang
// menjalankan `npm run build` (dibuktikan di log deploy 17 Sep). Artinya kebocoran
// menggagalkan deploy, bukan sekadar memberi tahu orang yang kebetulan ingat memindai.
// Masih bisa dijalankan sendiri: `node uji/pindai-bundel.mjs` sesudah ada build.
//
// Kebenaran terakhir untuk pertanyaan "apakah harga Acquisition sampai ke peramban".
// `uji/batas-harga.test.mjs` menjaganya lewat graf impor dan jalan di setiap `periksa`;
// berkas ini memeriksa apa yang BENAR-BENAR dikirim bundler.
//
// Yang dicari hanya angka yang tidak muncul di tier Price List atau Bottom mana pun —
// angka yang bisa ada karena alasan sah tidak dihitung. Angka bulat ribuan dicari dalam
// dua bentuk, "43000" dan bentuk minified "43e3". Chunk dengan tiga angka khas atau
// lebih dianggap memuat pricelist; satu-dua bisa kebetulan.
//
// Ditemukan 10 Sep 2026 dengan pemindai ini: 2 chunk memuat 11 dari 13 angka khas,
// termasuk harfiah `{id:"lms",…,p:[1e5,66e3,43e3]}`. Setelah perbaikan 11 Sep: 0.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { muat } from './muat.mjs';
import { terlarangKlien } from './terlarang-klien.mjs';

const AKAR = new URL('..', import.meta.url).pathname;
const STATIS = join(AKAR, '.next/static');
if (!existsSync(STATIS)) { console.error('Belum ada build. Jalankan `npm run build` dulu.'); process.exit(2); }

const { KOMPONEN, PRESET } = muat('pricelist');
const semua = [...KOMPONEN.map((k) => k.p), ...PRESET.map((p) => p.p)];
const tier01 = new Set(semua.flatMap((p) => [p[0], p[1]]).filter((v) => v != null));
const khas = [...new Set(semua.map((p) => p[2]).filter((v) => v != null && !tier01.has(v)))];
if (!khas.length) { console.error('Tidak ada angka khas Acquisition — pemindai ini perlu ditinjau.'); process.exit(2); }

const pola = khas.map((v) => new RegExp(`[^0-9.]${v % 1000 === 0 ? `(?:${v}|${v / 1000}e3)` : v}[^0-9e]`));
const chunk = [];
(function jalan(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) jalan(p); else if (n.endsWith('.js')) chunk.push(p);
  }
})(STATIS);

const bocor = [];
for (const f of chunk) {
  const s = readFileSync(f, 'utf8');
  const n = pola.filter((r) => r.test(s)).length;
  if (n >= 3) bocor.push(`${f.slice(AKAR.length)} memuat ${n} dari ${khas.length} angka khas Acquisition`);
}
if (bocor.length) {
  console.error('HARGA ACQUISITION TERKIRIM KE PERAMBAN:\n  ' + bocor.join('\n  '));
  process.exit(1);
}
// Sejak ekstraksi scan (catatan/25): nama kunci penyedia, hostnya, dan nama modelnya tidak boleh
// sampai ke bundel klien. Pemeriksaan angka Acquisition di atas tidak menangkapnya, karena yang
// bocor bukan harga melainkan kuasa memanggil penyedia.
//
// Daftarnya DITURUNKAN dari lib/penyedia-ekstraksi.ts, bukan dipatok: daftar yang dipaku berhenti
// menjaga begitu host atau modelnya berganti, dan tetap hijau sambil memeriksa hal yang salah.
const { kunci, model, host } = terlarangKlien();
const terlarang = [kunci, model, ...host];
const bocorKunci = [];
for (const f of chunk) {
  const s = readFileSync(f, 'utf8');
  for (const t of terlarang) {
    if (s.includes(t)) bocorKunci.push(`${f.slice(AKAR.length)} memuat ${t}`);
  }
}
if (bocorKunci.length) {
  console.error('KUNCI PENYEDIA TERKIRIM KE PERAMBAN:\n  ' + bocorKunci.join('\n  '));
  process.exit(1);
}
console.log(`  OK  ${chunk.length} chunk klien bersih dari nama kunci penyedia, host, dan nama model`);

console.log(`  OK  ${chunk.length} chunk klien bersih dari ${khas.length} angka khas Acquisition`);
