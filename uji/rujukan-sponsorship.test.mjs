// Tabel rujukan 15% di catatan/18 dihitung ulang dari lib/pricelist.ts.
//
// Tabel itu dipakai Sales untuk menaksir batas sponsorship sebelum PO-nya ada. Kalau harga
// berubah dan tabelnya tidak, Sales memakai angka yang salah dan tidak ada yang tahu —
// dokumen tidak punya uji, kecuali yang ini.
//
// Yang DIPERIKSA sistem tetap 15% dari grand total PO yang sebenarnya (aturan IoM
// sponsorship-dalam-batas); tabel ini cuma rujukan. Karena itu yang dijaga di sini
// kecocokannya dengan pricelist, bukan perilakunya.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { KOMPONEN, PRESET } = muat('pricelist');
const doc = readFileSync(new URL('../catatan/18-spesifikasi-nilai-sponsorship.md', import.meta.url), 'utf8');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.ok(KOMPONEN.length > 0 && PRESET.length > 0, 'pricelist kosong — pemuat rusak');

/** "52.500" -> 52500. Titik di sini pemisah ribuan, bukan desimal. */
const angka = (s) => Number(String(s).trim().replace(/\./g, ''));
/** Kebijakan Skolla: 15%, dibulatkan ke bawah. */
const limaBelas = (v) => Math.floor((v * 15) / 100);

/** Baris tabel Markdown di bawah sebuah judul tebal, tanpa baris kepala dan pemisah. */
function baris(judul) {
  const i = doc.indexOf(judul);
  assert.ok(i > 0, `judul tabel tidak ketemu: ${judul}`);
  const keluar = [];
  for (const l of doc.slice(i).split('\n').slice(1)) {
    const t = l.trim();
    if (!t.startsWith('|')) { if (keluar.length) break; continue; }
    if (/^\|[\s:|-]+\|$/.test(t)) continue;
    const sel = t.split('|').slice(1, -1).map((x) => x.trim());
    if (/^(Paket|Komponen|Add-on)$/i.test(sel[0])) continue;
    keluar.push(sel);
  }
  assert.ok(keluar.length > 0, `tabel kosong di bawah ${judul} — pengurai rusak`);
  return keluar;
}

const cari = (nama) => KOMPONEN.find((k) => k.s === nama) ?? KOMPONEN.find((k) => k.n === nama);

// --- Paket: | Paket | Price List | 15% | Bottom Price | 15% |
{
  const rows = baris('**Paket**');
  assert.equal(rows.length, PRESET.length,
    `tabel paket ${rows.length} baris, PRESET ${PRESET.length} — ada paket yang tidak tercatat`);
  for (const [nama, pl, pl15, bp, bp15] of rows) {
    const p = PRESET.find((x) => x.n === nama);
    assert.ok(p, `paket "${nama}" di catatan/18 tidak ada di PRESET`);
    assert.equal(angka(pl), p.p[0], `${nama}: price list tabel ${pl}, pricelist ${p.p[0]}`);
    assert.equal(angka(bp), p.p[1], `${nama}: bottom tabel ${bp}, pricelist ${p.p[1]}`);
    assert.equal(angka(pl15), limaBelas(p.p[0]), `${nama}: 15% price list tabel ${pl15}`);
    assert.equal(angka(bp15), limaBelas(p.p[1]), `${nama}: 15% bottom tabel ${bp15}`);
  }
  ok(`${rows.length} paket: harga dan 15%-nya cocok dengan PRESET`);
}

// --- Komponen satuan dan Add-on: | Nama | 15% Price List | 15% Bottom Price |
for (const judul of ['**Komponen satuan**', '**Add-on, per siswa per sesi**']) {
  const rows = baris(judul);
  for (const [nama, pl15, bp15] of rows) {
    const k = cari(nama);
    assert.ok(k, `komponen "${nama}" di catatan/18 tidak ada di KOMPONEN`);
    assert.equal(angka(pl15), limaBelas(k.p[0]),
      `${nama}: 15% price list tabel ${pl15}, seharusnya ${limaBelas(k.p[0])}`);
    assert.equal(angka(bp15), limaBelas(k.p[1]),
      `${nama}: 15% bottom tabel ${bp15}, seharusnya ${limaBelas(k.p[1])}`);
  }
  ok(`${judul.replace(/\*/g, '')}: ${rows.length} baris cocok dengan KOMPONEN`);
}

// Acquisition Price sengaja tidak ada di tabel mana pun — tabel ini dibaca Sales.
//
// Dijaga secara STRUKTUR, bukan dengan memindai angka. Dua percobaan memindai angka
// langsung salah tuduh, dan sebabnya mendasar: sel tabel ini berisi nilai 15% yang
// dihitung, dan angka itu bisa kebetulan sama persis dengan harga Acquisition produk lain
// (25.000 = Acquisition Latihan Soal sekaligus Price List paket Tryout; 9.000 = Acquisition
// Tryout sekaligus 15% dari Price List Latihan Soal). Memindai angka di sini akan selalu
// gaduh. Lagi pula setiap sel angka SUDAH dipatok ke nilai turunan tier 0/1 oleh
// pemeriksaan di atas, jadi yang tersisa hanyalah risiko seseorang menambah KOLOM baru.
{
  const kepala = doc.split('\n').filter((l) => l.trim().startsWith('|') && /15%|Price List|Bottom/.test(l));
  assert.ok(kepala.length >= 3, 'baris kepala tabel tidak ketemu — pengurai rusak');
  for (const l of kepala) {
    assert.ok(!/acquisition/i.test(l),
      `ada kolom Acquisition di tabel rujukan catatan/18: ${l.trim().slice(0, 70)}`);
  }
  ok(`${kepala.length} baris kepala tabel, tidak satu pun menyebut Acquisition`);
}

// Cap versi yang disebut catatan/18 harus cap yang berlaku sekarang.
const { VERSI_PRICELIST } = muat('pricelist');
assert.ok(doc.includes(VERSI_PRICELIST),
  `catatan/18 menyebut cap pricelist lain; sekarang ${VERSI_PRICELIST}`);
ok(`catatan/18 menyebut cap pricelist yang berlaku (${VERSI_PRICELIST})`);

console.log(`\n${n} pemeriksaan lolos.`);
