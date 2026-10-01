// Setiap kueri BACA ke Supabase (.from, .rpc) di halaman server dan route handler
// harus dibungkus wajib(), supaya galat jaringan/RLS/Postgres melempar ke error.tsx
// (atau jadi 500) alih-alih tampil sebagai "Belum ada ..." atau "tidak ditemukan".
// Tanpa itu orang menyimpulkan datanya memang tidak ada, lalu membuat PO atau
// sekolah ganda.
//
// Pengecualian ditandai di kodenya sendiri: komentar "sengaja tidak diwajibkan"
// di pernyataan itu, berikut alasannya. Bukan daftar nomor baris, yang bergeser
// setiap kali berkasnya disunting.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';

const AKAR = new URL('..', import.meta.url).pathname;
const PENANDA = 'sengaja tidak diwajibkan';
const KUERI = /(?<!storage)\.(from|rpc)\(\s*['"]/g;

function berkas(dir, keluar = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, keluar);
    else if (/\.tsx?$/.test(n)) keluar.push(p);
  }
  return keluar;
}

// Naik dari kueri lewat kurung yang MEMBUNGKUSNYA saja (kurung yang sudah
// tertutup dilewati), sampai batas pernyataan. Mencari substring wajib( di
// seluruh pernyataan tidak cukup: wajib( milik kueri tetangga, atau pemanggilan
// wajib lain yang tak berhubungan, ikut "memaafkan" kueri yang bolong.
function dibungkusWajib(teks, i) {
  let dalam = 0;
  for (let j = i - 1; j >= 0; j--) {
    const c = teks[j];
    if (c === ')' || c === ']') dalam++;
    else if (c === '(' || c === '[') {
      if (dalam > 0) { dalam--; continue; }
      if (c === '(' && /\bwajib\s*$/.test(teks.slice(Math.max(0, j - 12), j))) return true;
    } else if (dalam === 0 && (c === ';' || c === '{' || c === '}')) return false;
  }
  return false;
}

// Turun dari kueri sepanjang rantai builder-nya sampai ungkapannya selesai
// (koma, kurung tutup, atau titik koma di kedalaman nol), mencari .then(wajib)
// di rantai itu sendiri, bukan milik elemen Promise.all yang lain.
function dirantaiWajib(teks, i) {
  let dalam = 0;
  for (let j = i; j < teks.length; j++) {
    const c = teks[j];
    if (c === '(' || c === '[' || c === '{') dalam++;
    else if (c === ')' || c === ']' || c === '}') {
      if (dalam === 0) return false;
      dalam--;
    } else if (dalam === 0 && (c === ',' || c === ';')) return false;
    if (dalam === 0 && teks.startsWith('.then(wajib)', j)) return true;
  }
  return false;
}

// Mengembalikan [jumlah kueri, daftar kueri yang tidak dibungkus].
function periksa(teks, nama) {
  let jumlah = 0;
  const bolong = [];
  for (const m of teks.matchAll(KUERI)) {
    jumlah++;
    // Penanda cukup ada di pernyataan itu (komentar di atasnya ikut, karena letaknya
    // sesudah titik koma sebelumnya). Satu penanda memaafkan satu pernyataan, jadi
    // jangan menggabungkan kueri lunak dan kueri wajib dalam satu pernyataan.
    const kepala = teks.slice(teks.lastIndexOf(';', m.index) + 1, m.index);
    if (dibungkusWajib(teks, m.index) || dirantaiWajib(teks, m.index) || kepala.includes(PENANDA)) continue;
    // urut = kueri ke berapa di teks ini; nomor baris tidak cukup untuk contoh sebaris.
    bolong.push({ urut: jumlah - 1, pesan: `${nama}:${teks.slice(0, m.index).split('\n').length}: .${m[1]}() tidak diwajibkan` });
  }
  return [jumlah, bolong];
}

// Pemeriksa diperiksa dulu, termasuk kasus yang pernah meloloskan kueri bolong.
const CONTOH = [
  ["const { data: a } = wajib(await sb.from('a').select());", []],
  ["const { data: b } = await sb.from('b').select();", [0]],
  ["const [x, y] = await Promise.all([sb.from('x').then(wajib), sb.from('y')]);", [1]],
  ["const r = { a: wajib(await sb.from('p').select()), b: await sb.from('q').select() };", [1]],
  ["const [a, b] = [\n  wajib(await sb.from('p').select()),\n  await sb.from('q').select(),\n];", [1]],
  ["if (wajib(lain)) { const { data } = await sb.from('z').select('c'); }", [0]],
  ["const { count } = wajib(await saring(sb.from('s')\n  .select('id', { count: 'exact' })).range(0, 9));", []],
  ["// " + PENANDA + ": contoh\nconst { data: z } = await sb.rpc('z');", []],
];
for (const [kode, harap] of CONTOH) {
  const [, bolong] = periksa(kode, 'contoh');
  const urut = bolong.map((b) => b.urut);
  assert.deepEqual(urut, harap,
    `pemeriksa salah menilai:\n${kode}\n-> kueri bolong ke-${urut.join(', ') || '(tidak ada)'}, harusnya ${harap.join(', ') || '(tidak ada)'}`);
}
console.log(`  OK  pemeriksa menilai benar ${CONTOH.length} contoh, termasuk dua kueri dalam satu pernyataan`);

const sasaran = [
  ...berkas(join(AKAR, 'app', '(sistem)')),
  ...berkas(join(AKAR, 'app', 'api')),
  join(AKAR, 'lib', 'supabase-server.ts'),
];
let total = 0;
const semuaBolong = [];
for (const p of sasaran) {
  const [n, bolong] = periksa(readFileSync(p, 'utf8'), relative(AKAR, p));
  total += n;
  semuaBolong.push(...bolong.map((b) => b.pesan));
}

assert.ok(total >= 0, `hanya ${total} kueri terdeteksi, pemeriksa ini rusak atau berkas berkurang`);
console.log(`  OK  ${total} kueri BACA terdeteksi`);
assert.deepEqual(semuaBolong, [], `${semuaBolong.length} kueri belum diwajibkan:\n  ${semuaBolong.join('\n  ')}`);
console.log('  OK  seluruh kueri BACA diwajibkan atau ditandai sengaja');
console.log('\n2 pemeriksaan lolos.');
