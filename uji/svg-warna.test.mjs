// Warna grafik HANYA boleh datang dari stylesheet, dipilih lewat kelas w-<nama>.
//
// Tiga bentuk lain sudah terbukti gagal di peramban Rizki — seluruh cincin
// hitam — sementara ketiganya tampak benar di peramban yang dipakai memeriksa:
//   1. fill="var(--x)"                atribut presentasi SVG
//   2. style={{ fill: 'var(--x)' }}   properti warna inline
//   3. style={{ ['--warna']: ... }}   custom property disetel inline
//
// Karena tidak satu pun tertangkap oleh pratinjau, penjaganya harus statis.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';

const AKAR = new URL('..', import.meta.url).pathname;

function berkas(dir, keluar = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === 'graphify-out' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, keluar);
    else if (/\.tsx?$/.test(n)) keluar.push(p);
  }
  return keluar;
}

const sumber = berkas(join(AKAR, 'app')).concat(berkas(join(AKAR, 'lib')));
const pelanggaran = [];

for (const p of sumber) {
  // Komentar dibuang: berkas ini dan lib/grafik.tsx menyebut bentuk yang salah
  // sebagai contoh, dan menandainya hanya melatih orang mengabaikan hasil uji.
  const s = readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const rel = relative(AKAR, p);

  for (const m of s.matchAll(/\b(fill|stroke)="var\(/g)) pelanggaran.push(`${rel}: ${m[0]}`);
  for (const m of s.matchAll(/\b(fill|stroke|background|backgroundColor)\s*:\s*([^,}\n]+)/g)) {
    if (/var\(|\bwarna\b|PALET/.test(m[2])) pelanggaran.push(`${rel}: ${m[0].trim().slice(0, 56)}`);
  }
  for (const m of s.matchAll(/\['--warna'/g)) pelanggaran.push(`${rel}: ${m[0]}`);
  // Nilai warna harus nama token, bukan var(...) — kelasnya dirakit dari nama.
  for (const m of s.matchAll(/warna:\s*'var\(/g)) pelanggaran.push(`${rel}: ${m[0]}`);
}

assert.deepEqual(pelanggaran, [],
  'warna grafik tidak datang dari stylesheet:\n  ' + pelanggaran.join('\n  '));
console.log(`  OK  ${sumber.length} berkas diperiksa, tidak ada warna yang dipasang inline`);

// Setiap kelas w-<nama> yang dipakai harus benar-benar ada di stylesheet.
const css = readFileSync(join(AKAR, 'app/globals.css'), 'utf8');
const dipakai = new Set();
for (const p of sumber) {
  for (const m of readFileSync(p, 'utf8').matchAll(/warna:\s*'([a-z-]+)'/g)) dipakai.add(m[1]);
}
const hilang = [...dipakai].filter((n) => !css.includes(`.w-${n}{`));
assert.deepEqual(hilang, [], 'nama warna dipakai tapi kelasnya tidak ada: ' + hilang.join(', '));
console.log(`  OK  ${dipakai.size} nama warna dipakai, semuanya punya kelas di stylesheet`);

// Kelas warna menulis heksa harfiah, bukan var(), karena var() tidak pernah
// diterapkan pada fill/stroke di peramban Rizki. Duplikasi itu mengundang
// penyimpangan, jadi nilainya dijaga tetap sama dengan tokennya.
const blokTerang = css.slice(css.indexOf(':root{'), css.indexOf(':root[data-theme="dark"]{'));
const blokGelap = css.slice(css.indexOf(':root[data-theme="dark"]{'));
const ambil = (blok, nama) => (blok.match(new RegExp(`--st-${nama}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
const beda = [];
for (const n of dipakai) {
  const token = { terang: ambil(blokTerang, n), gelap: ambil(blokGelap, n) };
  if (!token.terang) continue;   // warna cadangan seperti primary-fill
  const kelasTerang = (css.match(new RegExp(`\\.donat-juring\\.w-${n}\\{fill:(#[0-9A-Fa-f]{6})\\}`)) || [])[1];
  const kelasGelap = (css.match(
    new RegExp(`:root\\[data-theme="dark"\\] \\.donat-juring\\.w-${n}\\{fill:(#[0-9A-Fa-f]{6})\\}`)) || [])[1];
  if (kelasTerang !== token.terang) beda.push(`${n} terang: kelas ${kelasTerang} vs token ${token.terang}`);
  if (kelasGelap !== token.gelap) beda.push(`${n} gelap: kelas ${kelasGelap} vs token ${token.gelap}`);
}
assert.deepEqual(beda, [], 'kelas warna menyimpang dari tokennya:\n  ' + beda.join('\n  '));
console.log('  OK  kelas warna harfiah sama dengan nilai tokennya di kedua tema');

// var() tidak boleh kembali ke jalur warna grafik.
const pakaiVar = [...css.matchAll(/\.(?:donat-juring|donat-cincin)\.w-[a-z-]+\{[^}]*var\(/g)];
assert.equal(pakaiVar.length, 0, 'kelas warna grafik memakai var(), yang tidak diterapkan di sebagian peramban');
console.log('  OK  tidak ada var() di jalur warna grafik');
// Potongan tanpa `warna` harus tetap berwarna. Tanpa cadangan di dalam Donat,
// kelasnya jadi `w-undefined`, tidak cocok dengan aturan mana pun, dan juringnya
// hitam — persis yang terlihat di DevTools Rizki.
const halaman = ['_dasbor-terang.html', '_dasbor-gelap.html'];
for (const h of halaman) {
  if (!existsSync(h)) continue;
  const isi = readFileSync(h, 'utf8');
  assert.equal(isi.includes('w-undefined'), false, `${h} memuat kelas w-undefined`);
  const kelas = [...isi.matchAll(/class="(?:donat-juring|donat-cincin|donat-titik) w-([a-z-]+)/g)]
    .map((m) => m[1]);
  const tanpaAturan = [...new Set(kelas)].filter((n) => !css.includes(`.w-${n}{`));
  assert.deepEqual(tanpaAturan, [], `${h}: kelas warna tanpa aturan: ` + tanpaAturan.join(', '));
}
const ada = halaman.filter((h) => existsSync(h));
assert.ok(ada.length, 'pratinjau belum dibuat — jalankan uji/pratinjau-dasbor.tsx dulu');
console.log(`  OK  ${ada.length} pratinjau dirender, tidak ada w-undefined dan semua kelasnya punya aturan`);
// Tautan polos. Selama ini tidak ada aturan warna untuk `a` sama sekali, jadi
// peramban memakai birunya sendiri: rgb(0,0,238), yang di atas permukaan gelap
// cuma 2,08:1 dan berubah ungu setelah dikunjungi. Tidak pernah kelihatan karena
// hampir semua tautan diberi kelas sendiri — yang polos justru yang terlewat.
assert.match(css, /a:not\(\[class\]\)\{color:var\(--primary-ink\)\}/,
  'tautan polos tanpa aturan warna akan memakai biru bawaan peramban');
assert.match(css, /a:not\(\[class\]\):visited\{color:var\(--primary-ink\)\}/,
  'tanpa :visited, tautan yang sudah dibuka berubah ungu bawaan');
// Aturannya WAJIB disaring :not([class]). Tanpa itu kekhususan a:visited (0,1,1)
// mengalahkan .preset (0,1,0), dan tautan bergaya tombol berubah warna begitu
// pernah dikunjungi.
assert.equal(/(^|[^)])\ba:visited\{/.test(css), false,
  'a:visited tanpa saringan akan menimpa warna tautan bergaya tombol');

const luminans = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const kontras = (a, b) => {
  const [x, y] = [luminans(a), luminans(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const kurang = [];
for (const [tema, blok] of [['terang', blokTerang], ['gelap', blokGelap]]) {
  const tinta = (blok.match(/--primary-ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
  for (const nama of ['surface', 'surface-2', 'bg']) {
    const latar = (blok.match(new RegExp(`--${nama}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
    if (!tinta || !latar) continue;
    const r = kontras(tinta, latar);
    if (r < 4.5) kurang.push(`${tema}: tautan ${tinta} di atas --${nama} ${latar} = ${r.toFixed(2)}:1`);
  }
}
assert.deepEqual(kurang, [],
  'warna tautan tidak lolos 4.5:1 untuk teks:\n  ' + kurang.join('\n  '));
console.log('  OK  tautan punya warna bertema dan lolos 4.5:1 di kedua tema');
console.log('\n6 pemeriksaan lolos.');
