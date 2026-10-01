// Syarat dan pembekuan nilai sponsorship, dibaca dari berkas migrasinya sendiri.
//
// Perilakunya sudah dibuktikan langsung di basis data dalam transaksi yang dibatalkan
// (catatan/19 Tugas 1). Uji ini untuk kelak: menangkap saat seseorang "merapikan"
// migrasinya dan diam-diam membuka pintu yang ditutup.
//
// KENAPA BERKAS INI ADA, padahal sudah ada uji/syarat-maju.test.mjs: uji itu membaca
// 20260917_syarat_maju_iom.sql, dan 20260920a MENGGANTIKAN fungsi yang sama. Berkas lama
// tidak berubah, jadi uji lama tetap hijau walaupun klausul yang dijaganya hilang dari
// versi yang benar-benar terpasang. Uji ini membaca berkas yang TERBARU, dan ikut menjaga
// klausul warisan itu supaya tidak hilang diam-diam.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

// Setiap bagian dibaca dari migrasi TERAKHIR yang mendefinisikannya. Versi pertama berkas
// ini justru mematok '20260920a' — persis anti-pola yang kepalanya sendiri janjikan sudah
// dihindari. QA independen membuktikannya: menaruh migrasi baru yang mengosongkan
// jaga_syarat_maju membuat SELURUH suite tetap hijau.
const kolom = migrasiTerakhir(/add column nilai_sponsorship/).isi;
const maju = migrasiTerakhir(/function private\.jaga_syarat_maju/).isi;
const beku = migrasiTerakhir(/function private\.bekukan_isi_po/).isi;
const sql = kolom;
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.ok(sql.length > 500, 'migrasi kosong — pemuat uji rusak');

// --- kolom ---
assert.match(sql, /add column nilai_sponsorship bigint/,
  'kolom nilai_sponsorship hilang dari migrasi');
assert.match(sql, /check \(nilai_sponsorship is null or nilai_sponsorship >= 0\)/,
  'check nilai >= 0 hilang: nilai negatif jadi mungkin');
ok('kolom nilai_sponsorship ada, dan tidak boleh negatif');

// --- syarat berpasangan saat keluar draf ---
assert.ok(maju.length > 400, 'badan jaga_syarat_maju tidak ketemu');

assert.match(maju, /new\.versi_iom = private\.versi_iom_berlaku\(\)/,
  'gerbang versi hilang: PO berstempel versi lama ikut dituntut nilainya');
assert.match(maju, /Catatan sponsorship sudah diisi, tapi nilainya belum/,
  'syarat catatan-tanpa-nilai hilang');
assert.match(maju, /Nilai sponsorship sudah diisi, tapi catatannya belum/,
  'syarat nilai-tanpa-catatan hilang');
ok('catatan dan nilai wajib berpasangan, hanya untuk PO berstempel versi berlaku');

// Klausul warisan yang dijaga uji/syarat-maju.test.mjs atas berkas yang sudah digantikan.
// Tanpa ini Sales bisa mengosongkan stempel lewat PostgREST lalu lolos sebagai "PO lama".
assert.match(maju, /Versi IoM sebuah PO tidak bisa diubah/,
  'klausul versi_iom tidak bisa diubah hilang saat fungsi ditulis ulang');
assert.match(maju, /old\.status not in \('draf', 'ditolak'\) or new\.status in \('draf', 'ditolak'\)/,
  'gerbang "hanya transisi keluar draf" hilang');
ok('klausul warisan ikut terbawa: stempel tidak bisa diubah, gerbang keluar draf utuh');

// --- pembekuan ---
assert.ok(beku.length > 400, 'badan bekukan_isi_po tidak ketemu');

// Ini yang paling gampang hilang saat orang menyalin ulang daftar kolomnya.
assert.ok(/NEW\.nilai_sponsorship/.test(beku) && /OLD\.nilai_sponsorship/.test(beku),
  'nilai_sponsorship tidak ada di KEDUA tuple bekukan_isi_po: nilai pada PO yang sudah '
  + 'ditandatangani bisa diubah lewat PostgREST sementara tanda tangannya tetap menempel');
ok('nilai_sponsorship ikut dibekukan di kedua tuple');

// --- dokumen sponsorship di tahap PKS (20260920c) ---
{
  // Komentar dibuang dulu. Migrasi ini MENJELASKAN kenapa punya_peran('finance') salah,
  // jadi memindai berkas mentah akan menuduh komentarnya sendiri — dan memang begitu pada
  // percobaan pertama.
  const tanpaKomentar = (t) => t.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const dok = tanpaKomentar(migrasiTerakhir(/create table pks_dokumen_sponsorship/).isi);
  const gerbang = tanpaKomentar(migrasiTerakhir(/function public\.unggah_pks_basah/).isi);

  // Peran HARFIAH. punya_peran() meloloskan admin_utama untuk peran apa pun, jadi memakainya
  // di sini akan membuat butir d4 milik siapa saja yang berwenang — bukan milik Finance.
  assert.match(dok, /'finance' = any\(private\.peran_saya\(\)\)/,
    'kebijakan tulis tidak memakai peran finance harfiah');
  assert.doesNotMatch(dok, /punya_peran\('finance'\)/,
    "punya_peran('finance') meloloskan admin_utama — bukan yang dimaksud catatan/18");

  assert.match(dok, /lower\(oleh\) = lower\(auth\.jwt\(\) ->> 'email'\)/,
    'kolom oleh tidak dipaksa jadi pemanggilnya sendiri');
  assert.match(dok, /p\.versi = pks_dokumen_sponsorship\.versi_po/,
    'konfirmasi tidak diikat ke versi PO sekarang');

  assert.match(gerbang, /d\.versi_po = p\.versi/,
    'gerbang unggah tidak memeriksa versi konfirmasi');
  for (const c of ['form_ditandatangani', 'rekening_atas_nama_lembaga', 'meterai_bila_di_atas_5juta'])
    assert.ok(new RegExp(`and d\\.${c}`).test(gerbang), `gerbang unggah tidak menuntut ${c}`);
  ok('dokumen PKS: finance harfiah, oleh dipaksa, terikat versi, ketiga centang dituntut');
}

// --- rumus batas WAJIB bilangan bulat, di kedua sisi ---
//
// catatan/18 "Data" butir 4 menjadikan ini syarat keras, tapi sampai QA independen
// memeriksanya yang menjaganya cuma komentar: mengganti kedua sisi jadi `* 0.15` membuat
// seluruh suite tetap hijau. Pembulatan tidak boleh ikut menentukan lolos atau gagal.
{
  const mesinSql = migrasiTerakhir(/function private\.nilai_iom/).isi;
  const iomTs = readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8');
  const tanpaKomentarJs = (t) => t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const tanpaKomentarSql = (t) => t.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  assert.match(tanpaKomentarJs(iomTs), /nilaiSp \* 100 <= f\.grandTotal \* 15/,
    'lib/iom.ts tidak lagi memakai perbandingan bilangan bulat');
  assert.match(tanpaKomentarSql(mesinSql), /v_sp_nilai \* 100 <= v\.grand_total \* 15/,
    'private.nilai_iom tidak lagi memakai perbandingan bilangan bulat');
  for (const [nama, teks] of [['lib/iom.ts', tanpaKomentarJs(iomTs)],
                              ['private.nilai_iom', tanpaKomentarSql(mesinSql)]]) {
    assert.doesNotMatch(teks, /0\.15/, `${nama} memakai 0.15 — pecahan tidak boleh menentukan batas`);
  }
  ok('rumus batas bilangan bulat di lib/iom.ts dan private.nilai_iom, tanpa 0.15');
}

console.log(`\n${n} pemeriksaan lolos.`);
