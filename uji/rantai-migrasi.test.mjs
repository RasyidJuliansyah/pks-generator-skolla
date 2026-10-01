// Setiap migrasi baru harus ada di DUA tempat, dan isinya sama persis.
//
// `supabase/migrasi/` menyimpan KENAPA sebuah penjagaan ditulis; `supabase/migrations/`
// menyimpan APA yang dijalankan, dan itulah yang dibaca `supabase db push` saat basis data
// dibangun ulang dari nol. Berkas yang cuma ada di tempat pertama akan hilang tanpa suara.
//
// Ujung rantai sudah dua kali berlubang, keduanya sebab yang sama: migrasi diterapkan ke
// produksi lewat Management API — jalur yang TIDAK menulis baris riwayat — lalu berkasnya
// berhenti di `migrasi/` tanpa pernah disalin ke rantai. 21 Sep 2026
// (`20260921_balasan_komentar`) dan 22 Sep 2026 (`20260922_kelompok_otomatis`,
// `20260922b_hoo_penutup_pembuat`).
//
// Yang membuatnya berbahaya justru ketiadaan gejalanya: `migration list` melaporkan jumlah
// lokal = jumlah awan dan `db push --dry-run` menjawab upToDate, sementara rebuild dari nol
// diam-diam kehilangan aturan-aturan itu. Tidak ada yang bisa menangkapnya selain
// membandingkan isi kedua folder — itulah satu-satunya tugas uji ini.
// Latar lengkapnya di `supabase/README.md`, bagian "Lubang di ujung rantai".
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const RANTAI = new URL('../supabase/migrations/', import.meta.url);
const CATATAN = new URL('../supabase/migrasi/', import.meta.url);

// Bukan tanggal sembarang: 21 Sep 2026 adalah hari riwayat awan ditarik ke repo dan rantai
// ini lahir. Sebelum itu kedua folder memang berbeda dan selamanya akan berbeda — rantai
// dibangun ulang dari riwayat awan, bukan disalin dari catatan. Sejak tanggal itu pula
// aturannya berlaku: tulis di `migrasi/`, salin apa adanya ke `migrations/` pada commit
// yang sama.
const SEJAK_RANTAI_LAHIR = '20260921';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const sql = (dir) => readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const tanggal = (f) => f.match(/^(\d{8})/)?.[1] ?? '';

const berkasCatatan = sql(CATATAN);

// Berkas tanpa awalan tanggal lolos dari saringan di bawah tanpa suara — lubang di dalam
// penjaganya sendiri, jadi ditutup lebih dulu.
const tanpaTanggal = berkasCatatan.filter((f) => !tanggal(f));
assert.deepEqual(tanpaTanggal, [],
  'berkas migrasi tanpa awalan tanggal, jadi tidak akan pernah diperiksa uji ini:\n  '
  + tanpaTanggal.join('\n  '));
ok(`${berkasCatatan.length} berkas migrasi semuanya berawalan tanggal`);

const rantai = sql(RANTAI).map((nama) => ({ nama, isi: readFileSync(new URL(nama, RANTAI)) }));
const catatan = berkasCatatan.filter((f) => tanggal(f) >= SEJAK_RANTAI_LAHIR)
  .map((nama) => ({ nama, isi: readFileSync(new URL(nama, CATATAN)) }));

// Kalau daftarnya kosong, uji ini hijau tanpa menjaga apa pun — dan hijau seperti itu
// lebih berbahaya daripada merah, karena terbaca sebagai "aman".
assert.ok(catatan.length > 0,
  `tidak ada migrasi sesudah ${SEJAK_RANTAI_LAHIR}; uji ini tidak menguji apa pun`);

const yatim = catatan.filter((c) => !rantai.some((r) => r.isi.equals(c.isi))).map((c) => c.nama);
assert.deepEqual(yatim, [],
  'migrasi ini ada di supabase/migrasi/ tapi tidak ada salinan identik di supabase/migrations/,'
  + ' jadi akan hilang saat basis data dibangun ulang:\n  ' + yatim.join('\n  ')
  + '\nSalin apa adanya ke rantai, lalu tandai `supabase migration repair --status applied <versi>`.');
ok(`${catatan.length} migrasi sejak ${SEJAK_RANTAI_LAHIR} punya salinan identik di rantai`);

// Arah sebaliknya sengaja TIDAK dijaga. Migrasi yang murni memperbaiki data produksi
// (mis. `20260921120000_segarkan_verdict_po344`) memang lahir langsung di rantai dan tidak
// punya padanan di catatan — dan itu wajar, karena rebuild tidak membutuhkannya. Yang
// berbahaya hanya satu arah: catatan -> rantai, yaitu aturan yang hilang saat rebuild.

console.log(`\n${n} pemeriksaan lolos.`);
