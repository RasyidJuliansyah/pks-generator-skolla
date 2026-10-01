// Migrasi empat penanda tangan (catatan/23): penjaga yang membaca migrasi TERAKHIR.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';
import { muat } from './muat.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const beku = migrasiTerakhir(/function private\.bekukan_isi_po/).isi
  .split('function private.bekukan_isi_po').pop();
const tuple = beku.split('is distinct from');
assert.ok(tuple.length >= 2, 'bekukan_isi_po tidak berbentuk tuple is distinct from tuple');
for (const kolom of ['skema_ttd', 'nama_rh']) {
  assert.match(tuple[0], new RegExp(`NEW\\.${kolom}\\b`), `${kolom} tidak ada di tuple NEW`);
  assert.match(tuple[1], new RegExp(`OLD\\.${kolom}\\b`), `${kolom} tidak ada di tuple OLD`);
}
ok('skema_ttd dan nama_rh beku di kedua tuple bekukan_isi_po');

const lihat = migrasiTerakhir(/function private\.boleh_lihat_semua/).isi;
assert.match(lihat.split('function private.boleh_lihat_semua').pop().split('$fn$;')[0], /'regional_head'/);
const acq = migrasiTerakhir(/function private\.boleh_lihat_acquisition/).isi;
assert.match(acq.split('function private.boleh_lihat_acquisition').pop().split('$fn$;')[0], /'regional_head'/);
ok('regional_head di kedua fungsi pembacaan');

// Daftar pihak di basis data = cerminnya di TS, urutan termasuk.
const { pihakUntuk } = muat('pihak');
const wajib = migrasiTerakhir(/function private\.pihak_wajib/).isi;
const larik = [...wajib.matchAll(/array\[([^\]]+)\]::pihak_ttd\[\]/g)]
  .map((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')));
assert.deepEqual(larik, [pihakUntuk(4), pihakUntuk(3)], 'private.pihak_wajib menyimpang dari lib/pihak.ts');
ok('private.pihak_wajib cermin persis pihakUntuk');

// Tidak ada lagi hitungan "3" harfiah di penjaga urutan status.
const urutan = migrasiTerakhir(/function private\.jaga_urutan_status_po/).isi
  .split('function private.jaga_urutan_status_po').pop();
assert.doesNotMatch(urutan, /<\s*3\b/, 'jaga_urutan_status_po masih membandingkan dengan 3 harfiah');
assert.match(urutan, /pihak_wajib\(new\.skema_ttd\)/);
ok('urutan status membaca pihak wajib dari skema PO');

// Pengajuan unggahan tidak lagi menyebut tiga pihak harfiah.
const aju = migrasiTerakhir(/function ajukan_po_unggahan/).isi.split('function ajukan_po_unggahan').pop();
assert.match(aju, /unnest\(private\.pihak_wajib\(v_po\.skema_ttd\)\)/);
ok('ajukan_po_unggahan menyisipkan penanda dari skema PO');

// Regional Head BOLEH berkomentar (keputusan Rizki 25 Sep 2026): jalur komentar tidak
// menyebut regional_head sama sekali, dan penolakan C Level tetap utuh di definisi TERAKHIR.
for (const pola of [/function private\.jaga_komentar_baru/, /function sunting_komentar/, /function hapus_komentar/]) {
  const { nama, isi } = migrasiTerakhir(pola);
  // Dipotong di `create or replace`, bukan di nama fungsi: `revoke ... on function <nama>`
  // sesudahnya juga cocok, dan potongan terakhir jadi bukan badan fungsinya.
  const buat = new RegExp('create or replace ' + pola.source);
  const badan = isi.split(buat).pop().split('$$;')[0];
  assert.doesNotMatch(badan, /regional_head/, `${pola} (${nama}) menolak regional_head`);
  assert.match(badan, /'c_level' = any \(private\.peran_saya\(\)\)/, `${pola} (${nama}) kehilangan penolakan C Level`);
}
const tulis = migrasiTerakhir(/policy komentar_tulis/).isi.split(/policy komentar_tulis/).pop().split(');')[0];
assert.doesNotMatch(tulis, /regional_head/);
// Bentuk tulisan tangan ATAU bentuk ternormalisasi Postgres (NOT ('c_level'::peran = ANY ...)):
// 20260927a menulis ulang policy ini lewat ALTER POLICY dengan teks dari pg_policies.
assert.match(tulis, /not \('c_level'(::peran)? = any/i);
ok('jalur komentar terbuka bagi regional_head dan tetap menolak C Level');

// PO skema 3 tidak bisa berganti asal (temuan QA akhir).
const maju = migrasiTerakhir(/function private\.jaga_syarat_maju/).isi.split('function private.jaga_syarat_maju').pop();
assert.match(maju, /new\.skema_ttd = 3 and new\.asal is distinct from old\.asal/);
ok('asal PO skema 3 beku');

console.log(`\n${n} pemeriksaan lolos.`);
