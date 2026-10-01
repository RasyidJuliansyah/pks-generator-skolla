// Corong menghitung "PERNAH mencapai tahap ini", bukan "sedang di tahap ini".
//
// Perbandingannya memakai indexOf pada daftar urutan, jadi status yang lupa
// dicantumkan bernilai -1 dan PO-nya lenyap dari SETIAP langkah. `aktif` dan
// `selesai` sempat begitu: PO yang layanannya sudah berjalan terhitung di "PO
// dibuat" lalu hilang dari langkah sesudahnya. Belum kelihatan karena belum ada
// yang memindahkan PO ke sana, dan justru itu yang berbahaya.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(
  readFileSync(new URL('../lib/status-po.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { URUTAN_TAHAP, pernahSampai, KODE_TAHAP_PO, KODE_TAHAP_PKS,
        SETELAH_VERIFIKASI } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Setiap status maju harus ada di URUTAN_TAHAP. Ini penjaga yang sebenarnya:
// status baru yang lupa dicantumkan langsung ketahuan di sini, bukan nanti
// sebagai angka corong yang salah tanpa ada yang sadar.
const majuSemua = [...KODE_TAHAP_PO, ...KODE_TAHAP_PKS].filter((k) => k !== 'ditolak');
const hilang = majuSemua.filter((k) => !URUTAN_TAHAP.includes(k));
assert.deepEqual(hilang, [], 'status maju tidak ada di URUTAN_TAHAP: ' + hilang.join(', '));
ok(`${majuSemua.length} status maju semuanya tercantum di URUTAN_TAHAP`);

assert.equal(URUTAN_TAHAP.includes('ditolak'), false, 'ditolak cabang buntu, bukan tahap maju');
ok('ditolak sengaja di luar urutan');

const po = [
  { status: 'draf' }, { status: 'menunggu_ttd' }, { status: 'ditandatangani' },
  { status: 'verifikasi' }, { status: 'terverifikasi' }, { status: 'pks_terbit' },
  { status: 'pks_ditandatangani' }, { status: 'aktif' }, { status: 'selesai' },
  { status: 'ditolak' }, { status: 'ditolak' },
];

assert.equal(pernahSampai(po, 'draf'), 9, 'sembilan PO maju, dua ditolak');
ok('yang ditolak tidak ikut terhitung');

assert.equal(pernahSampai(po, 'terverifikasi'), 5);
ok('terverifikasi menghitung dirinya sendiri dan seluruh tahap sesudahnya');

// Inti regresinya: PO yang layanannya berjalan HARUS ikut terhitung di setiap
// tahap sebelumnya. Dengan daftar urutan yang lama keduanya bernilai 0, karena
// indexOf mengembalikan -1 dan -1 >= 0 selalu salah.
assert.equal(pernahSampai([{ status: 'aktif' }, { status: 'selesai' }], 'draf'), 2);
assert.equal(pernahSampai([{ status: 'aktif' }, { status: 'selesai' }], 'pks_terbit'), 2);
ok('PO berstatus aktif dan selesai tetap terhitung di tahap-tahap sebelumnya');

// Corongnya menyempit, tidak pernah melebar.
const corong = ['draf', 'ditandatangani', 'verifikasi', 'terverifikasi',
  'pks_terbit', 'pks_ditandatangani'].map((k) => pernahSampai(po, k));
for (let i = 1; i < corong.length; i++) {
  assert.ok(corong[i] <= corong[i - 1], `corong melebar di langkah ${i}: ${corong}`);
}
ok('angka corong menurun monoton, tidak pernah melebar');

assert.equal(pernahSampai(po, 'status_yang_tidak_ada'), 9);
ok('tahap tak dikenal tidak diam-diam mengosongkan corong');

// Komposisi di Dashboard dibangun dari TAHAP_PO + TAHAP_PKS. Kalau ada status
// yang tidak tercantum di salah satunya, PO berstatus itu LENYAP dari panel
// komposisi — panelnya tampil "belum ada data" padahal PO-nya jelas ada. Persis
// yang terjadi saat komposisi PO hanya memuat tahap sebelum PKS.
const semuaTahap = [...KODE_TAHAP_PO, ...KODE_TAHAP_PKS];
const tidakTercakup = [...URUTAN_TAHAP, 'ditolak'].filter((k) => !semuaTahap.includes(k));
assert.deepEqual(tidakTercakup, [],
  'status tidak tercakup TAHAP_PO maupun TAHAP_PKS, jadi PO-nya lenyap dari komposisi: '
  + tidakTercakup.join(', '));
assert.equal(new Set(semuaTahap).size, semuaTahap.length,
  'ada status tercantum dua kali, juringnya akan terhitung ganda');
console.log(`  OK  ${semuaTahap.length} status tercakup komposisi, tidak ada yang ganda`);

// SETELAH_VERIFIKASI dipakai tiga halaman untuk menjawab "tahap verifikasinya
// sudah lewat". Kalau ada status maju yang tidak tercantum, PO berstatus itu
// LENYAP dari arsipnya sendiri — halamannya tampil kosong padahal keputusannya
// ada. Persis yang terjadi pada Antrean Verifikasi: arsipnya menyaring hanya
// 'terverifikasi' dan 'ditolak', sehingga PO yang sudah maju ke tahap PKS
// hilang meski keempat fungsi sudah memutuskan.
const mulaiVerifikasi = URUTAN_TAHAP.indexOf('terverifikasi');
const sesudahnya = URUTAN_TAHAP.slice(mulaiVerifikasi);
const luput = sesudahnya.filter((k) => !SETELAH_VERIFIKASI.includes(k));
assert.deepEqual(luput, [],
  'status sesudah verifikasi tidak ada di SETELAH_VERIFIKASI, PO-nya akan lenyap '
  + 'dari daftar Surat, PKS, dan arsip Antrean Verifikasi: ' + luput.join(', '));
assert.equal(SETELAH_VERIFIKASI.includes('verifikasi'), false,
  'status yang MASIH berjalan tidak boleh dianggap sudah lewat verifikasi');
console.log(`  OK  ${sesudahnya.length} status sesudah verifikasi tercakup SETELAH_VERIFIKASI`);

console.log(`\n${n + 2} pemeriksaan lolos.`);
