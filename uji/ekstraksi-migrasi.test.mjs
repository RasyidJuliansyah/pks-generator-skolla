// Penjaga statis untuk migrasi ekstraksi (catatan/25). Bukan bukti perilaku — bukti perilakunya
// ada di uji/db-lokal/bukti-gerbang-ekstraksi.sql. Yang dijaga di sini adalah hal-hal yang
// gampang terlupa saat fungsi ditulis ulang: kolom baru masuk KEDUA tuple pembekuan, kolom baru
// dikeluarkan dari sidik, dan penanda baru punya penjaga.
//
// ⚠️ Asersinya WAJIB dipersempit ke badan fungsinya. `migrasiTerakhir` mengembalikan SELURUH isi
// berkas migrasi, dan nama kolom baru muncul di banyak tempat di dalamnya (alter table, comment
// on column, trigger penanda). Menghitungnya berkas-lebar membuat penjaga ini merah karena hal
// yang salah — dan, lebih buruk, bisa hijau karena kebetulan jumlahnya pas.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

/** Badan satu fungsi dari isi berkas migrasi: dari `function <nama>` sampai `function` berikutnya. */
function badan(isi, nama) {
  const mulai = isi.indexOf(`function ${nama}`);
  assert.ok(mulai >= 0, `fungsi ${nama} tidak ada di migrasi terakhir yang mendefinisikannya`);
  const sesudah = isi.indexOf('create or replace function', mulai);
  return isi.slice(mulai, sesudah === -1 ? isi.length : sesudah);
}

const beku = badan(migrasiTerakhir(/function private\.bekukan_isi_po/).isi, 'private.bekukan_isi_po');
for (const kolom of ['dibaca_ai_pada', 'ekstraksi_menunggu']) {
  assert.equal((beku.match(new RegExp(`NEW\\.${kolom}`, 'g')) ?? []).length, 1,
    `${kolom} harus ada di tuple NEW private.bekukan_isi_po`);
  assert.equal((beku.match(new RegExp(`OLD\\.${kolom}`, 'g')) ?? []).length, 1,
    `${kolom} harus ada di tuple OLD private.bekukan_isi_po`);
}
ok('kolom baru ikut dibekukan pada PO yang sudah keluar draf (kedua tuple, kedua kolom)');

const penanda = badan(migrasiTerakhir(/function private\.jaga_penanda_otomatis/).isi,
  'private.jaga_penanda_otomatis');
assert.match(penanda, /app\.penanda_ekstraksi/);
// Penjagaan yang sudah ada TIDAK boleh hilang saat fungsi ini ditulis ulang.
assert.match(penanda, /app\.penutup_iom/);
ok('po_jaga_penanda mengenal setelan app.penanda_ekstraksi, penjagaan lama tetap');

const sidik = badan(migrasiTerakhir(/function private\.sidik_tinjauan/).isi, 'private.sidik_tinjauan');
assert.match(sidik, /case when p\.dibaca_ai_pada is null then 'dibaca_ai_pada' else '' end/);
// Kolom baru yang muncul kosong di setiap baris akan membasikan tinjauan yang sudah ada.
assert.match(sidik, /case when p\.nama_rh is null then 'nama_rh' else '' end/);
// `ekstraksi_menunggu` dikeluarkan TANPA syarat, di dalam daftar tolak -- bukan lewat case when.
// Ia memang berubah saat Sales mencentang, dan itu bukan perubahan isi PO: dikuncikan di sidik,
// setiap centang membatalkan pernyataan "sesuai pindaian".
assert.match(sidik, /'skema_ttd', 'ekstraksi_menunggu'\]\)/);
assert.doesNotMatch(sidik, /case when p\.ekstraksi_menunggu/);
ok('dibaca_ai_pada dikeluarkan selama kosong, ekstraksi_menunggu selalu, pengecualian lama tetap');

// Layar menjalankan halaman Form PO dengan sesi SALES, sedangkan RLS tabel gerbang hanya untuk
// Super Admin. Tanpa pembaca satu-bit ini, `menyala` selalu terbaca false bagi Sales dan kotak
// "Baca scan" tidak pernah muncul.
const gerbang = migrasiTerakhir(/function public\.gerbang_ekstraksi_menyala/).isi;
assert.match(gerbang, /revoke all on function public\.gerbang_ekstraksi_menyala\(\) from public, anon/);
assert.match(gerbang, /grant execute on function public\.gerbang_ekstraksi_menyala\(\) to authenticated/);
ok('keadaan gerbang bisa dibaca authenticated lewat satu fungsi, tanpa membuka tabelnya');

console.log(`\n${n} pemeriksaan lolos.`);
