// Fungsi tidak bisa dioper dari Server Component ke komponen klien: React tidak
// bisa menyerialkannya dan halamannya melempar SAAT BERJALAN, bukan saat
// dibangun. Build tetap hijau sementara produksi mati.
//
// Sudah dua kali menggigit: rp/rpSingkat diimpor dari modul 'use client' ke
// halaman server, lalu prop `satuan` dioper sebagai fungsi ke BatangPeringkat.
// Pemeriksa ini menangkap bentuk yang kedua.
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const semua = berkas(join(AKAR, 'app')).concat(berkas(join(AKAR, 'lib')));
const isi = new Map(semua.map((p) => [p, readFileSync(p, 'utf8')]));

// Komponen yang diekspor dari berkas bertanda 'use client'.
const komponenKlien = new Set();
for (const [p, s] of isi) {
  if (!/^\s*['"]use client['"]/m.test(s)) continue;
  for (const m of s.matchAll(/export\s+(?:default\s+)?function\s+([A-Z]\w*)/g)) {
    komponenKlien.add(m[1]);
  }
}
assert.ok(komponenKlien.size > 0, 'tidak ada komponen klien terdeteksi — pemeriksa ini rusak');
console.log(`  OK  ${komponenKlien.size} komponen klien terdeteksi: ${[...komponenKlien].join(', ')}`);

// Prop bernilai fungsi literal yang dioper ke komponen klien dari berkas server.
const pelanggaran = [];
for (const [p, s] of isi) {
  if (/^\s*['"]use client['"]/m.test(s)) continue;   // berkas klien boleh
  for (const nama of komponenKlien) {
    const pola = new RegExp(`<${nama}\\b[\\s\\S]*?/?>`, 'g');
    for (const m of s.matchAll(pola)) {
      const tag = m[0];
      const fn = tag.match(/(\w+)=\{\s*(?:\([^)]*\)\s*=>|function\b|async\b)/);
      if (fn) pelanggaran.push(`${relative(AKAR, p)} → <${nama} ${fn[1]}={...}>`);
    }
  }
}
assert.deepEqual(pelanggaran, [],
  'fungsi dioper ke komponen klien dari berkas server:\n  ' + pelanggaran.join('\n  '));
console.log('  OK  tidak ada fungsi dioper dari berkas server ke komponen klien');

// Gigitan ketiga, dan yang paling sunyi: nilai biasa — bukan komponen — yang
// diekspor modul 'use client' lalu diimpor komponen server. Next.js menukarnya
// dengan rujukan klien, jadi `PALET[i]` bernilai undefined di server tanpa galat
// apa pun. Juring analitik keluar sebagai `w-undefined` dan hitam; build hijau,
// runtime diam.
const bocor = [];
for (const [p, teks] of isi) {
  if (/^\s*['"]use client['"]/.test(teks)) continue;      // hanya berkas server
  for (const m of teks.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const rel = m[2].replace(/^@\//, '');
    if (!rel.startsWith('lib/') && !rel.startsWith('.')) continue;
    const dituju = [...isi.keys()].find((q) =>
      relative(AKAR, q).replace(/\.tsx?$/, '') === rel
      || relative(AKAR, q).replace(/\.tsx?$/, '') === relative(AKAR, join(p, '..', rel)));
    if (!dituju || !/^\s*['"]use client['"]/.test(isi.get(dituju))) continue;
    for (const nama of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (nama.startsWith('type ')) continue;              // tipe dihapus saat kompilasi
      const bersih = nama.split(/\s+as\s+/)[0].trim();
      if (/^[A-Z][a-zA-Z0-9]*$/.test(bersih) && !/^[A-Z0-9_]+$/.test(bersih)) continue;  // komponen
      bocor.push(`${relative(AKAR, p)} mengimpor ${bersih} dari ${relative(AKAR, dituju)}`);
    }
  }
}
assert.deepEqual(bocor, [],
  "nilai bukan-komponen diimpor komponen server dari modul 'use client' "
  + '(jadi rujukan klien, bernilai undefined di server):\n  ' + bocor.join('\n  '));
console.log("  OK  tidak ada nilai bukan-komponen ditarik komponen server dari modul 'use client'");
console.log('\n3 pemeriksaan lolos.');
