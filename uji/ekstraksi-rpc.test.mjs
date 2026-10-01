// Penjaga statis RPC ekstraksi: EXECUTE dicabut dari PUBLIC, dan tabelnya tidak punya jalan
// tulis klien. Bukti perilakunya di uji/db-lokal/bukti-rpc-ekstraksi.sql.
//
// Sama seperti ekstraksi-migrasi.test.mjs: yang dibaca `migrasiTerakhir` adalah seluruh isi
// berkas, jadi asersinya menunjuk bentuk yang khas dan tidak menghitung kemunculan kata.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const rpc = migrasiTerakhir(/function public\.klaim_ekstraksi/).isi;
// Polanya nama fungsi + kurung buka, bukan tanda tangan lengkapnya: `selesai_ekstraksi` punya
// tujuh argumen bertipe, jadi daftar argumennya ikut berubah setiap kali tanda tangannya berubah,
// dan penjaga yang memakukannya akan merah karena alasan yang salah.
for (const f of ['klaim_ekstraksi', 'selesai_ekstraksi', 'tautkan_ekstraksi']) {
  assert.match(rpc, new RegExp(`revoke all on function public\\.${f}\\(`),
    `EXECUTE ${f} tidak dicabut dari PUBLIC`);
  assert.match(rpc, new RegExp(`grant execute on function public\\.${f}\\([^\\n]*to authenticated`),
    `${f} tidak diberikan ke authenticated`);
}
ok('ketiga RPC dicabut dari PUBLIC dan anon, lalu diberikan ke authenticated');

assert.match(rpc, /app\.penanda_ekstraksi/);
assert.match(rpc, /set_config\('app\.penanda_ekstraksi', ''/);
ok('tautkan_ekstraksi memasang lalu melepas penanda transaksi');

const tabel = migrasiTerakhir(/create table if not exists ekstraksi_po/).isi;
// Tanpa `unique`, satu PO bisa punya dua pembacaan: dua hasil baca yang berbeda menempel pada
// dokumen yang sama, dan tidak ada yang tahu mana yang dibaca Sales.
assert.match(tabel, /po_id\s+uuid unique references po\(id\)/);
ok('satu PO paling banyak satu pembacaan, ditegakkan unique di basis data');

// Seluruh penulisan lewat ketiga fungsi security definer. Satu policy tulis di sini membuka
// jalan bagi Sales menulis hasil baca palsu beserta angka tokennya lewat PostgREST.
assert.match(tabel, /policy ekstraksi_baca on ekstraksi_po for select/);
assert.doesNotMatch(tabel, /policy \w+ on ekstraksi_po for (insert|update|delete|all)/);
ok('tabel pembacaan hanya punya policy baca, tidak ada jalan tulis klien');

console.log(`\n${n} pemeriksaan lolos.`);
