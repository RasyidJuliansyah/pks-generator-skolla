// Peran pengawas — C Level, CBO, Head of Operations — melihat seluruh alur
// kerja sama tapi tidak menulis apa pun.
//
// Penjagaan sebenarnya ada di basis data: setiap jalur tulis menyebut perannya
// secara eksplisit, jadi peran yang tidak disebut di mana pun otomatis tidak
// bisa menulis. Uji ini menjaga sisi aplikasinya — supaya tidak ada yang kelak
// menyelipkan salah satu peran itu ke daftar yang memberi wewenang tulis, lalu
// tombolnya muncul dan orang mengira boleh menekannya.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(
  readFileSync(new URL('../lib/supabase-server.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({ }));
const {
  LABEL_PERAN, bolehBuatPo, adalahVerifikator, adalahLead,
  adalahSuperAdmin, bolehLihatAcquisition, bolehKomentar,
} = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const PENGAWAS = ['c_level', 'cbo', 'head_of_operations', 'regional_head'];

for (const p of PENGAWAS) {
  assert.equal(bolehBuatPo([p]), false, `${p} tidak boleh membuat PO`);
  assert.equal(adalahVerifikator([p]), false, `${p} tidak boleh memberi verifikasi`);
  assert.equal(adalahLead([p]), false, `${p} tidak boleh menerbitkan Surat`);
  assert.equal(adalahSuperAdmin([p]), false, `${p} bukan Super Admin`);
}
ok(`${PENGAWAS.length} peran pengawas: tidak satu pun memberi wewenang tulis`);

// Komentar bukan keputusan, jadi batasnya beda: yang dilarang cuma C Level.
//
// CBO dan Head of Operations tetap boleh berkomentar — keduanya memang bagian dari
// percakapan, dan Head of Operations bahkan sudah menulis lewat po_pengecualian.
// C Level satu-satunya yang dirancang menulis NOL; begitu ia boleh berkomentar,
// "read-only" berhenti berarti apa-apa.
assert.equal(bolehKomentar(['c_level']), false, 'C Level tidak boleh berkomentar');
assert.equal(bolehKomentar(['cbo']), true);
assert.equal(bolehKomentar(['head_of_operations']), true);
assert.equal(bolehKomentar(['sales']), true);
ok('C Level tidak bisa berkomentar; CBO dan Head of Operations bisa');

// Jebakan yang menunggu orang berikutnya: `berperan()` meloloskan admin_utama untuk
// peran APA PUN, jadi bolehKomentar yang ditulis `!berperan(p, ['c_level'])` akan
// mengunci Super Admin. Padanannya di basis data punya jebakan yang sama lewat
// private.punya_peran(), dan di sana juga sengaja dihindari.
assert.equal(bolehKomentar(['admin_utama']), true,
  'Super Admin ikut terkunci — bolehKomentar kemungkinan ditulis lewat berperan()');
assert.equal(bolehKomentar(['c_level', 'admin_utama']), false,
  'yang benar-benar memegang c_level tetap tidak menulis, sekalipun juga Super Admin');
ok('Super Admin tidak ikut terkunci, tapi pemegang c_level tetap tertutup');

assert.equal(bolehLihatAcquisition(['c_level']), true);
ok('C Level melihat harga Acquisition — keputusan yang disengaja, bukan kelalaian');

assert.equal(LABEL_PERAN.c_level, 'C Level');
ok('C Level punya label sendiri, jadi CEO tidak perlu diberi peran bernama CBO');

// Semua peran harus punya label: pemilih peran di Kelola Pengguna dibangun dari
// Object.keys(LABEL_PERAN), jadi peran tanpa label tidak akan pernah bisa
// diberikan lewat antarmuka — dan tidak ada galat apa pun yang memberitahu.
const sumber = readFileSync(new URL('../lib/pengguna-aksi.ts', import.meta.url), 'utf8');
const daftarAksi = [...sumber.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  .filter((x) => x in LABEL_PERAN);
const tanpaLabel = [...new Set(daftarAksi)].filter((p) => !LABEL_PERAN[p]);
assert.deepEqual(tanpaLabel, [], 'peran tanpa label: ' + tanpaLabel.join(', '));
const tanpaDiAksi = Object.keys(LABEL_PERAN).filter((p) => !daftarAksi.includes(p));
assert.deepEqual(tanpaDiAksi, [],
  'peran berlabel tapi tidak ada di SEMUA_PERAN, jadi akan ditolak saat disimpan: '
  + tanpaDiAksi.join(', '));
ok(`${Object.keys(LABEL_PERAN).length} peran: berlabel semua, dan semuanya bisa diberikan`);

// Regional Head Division (catatan/23): baca-saja pola C Level, termasuk Acquisition.
assert.equal(LABEL_PERAN.regional_head, 'Regional Head Division');
assert.equal(bolehLihatAcquisition(['regional_head']), true);
assert.equal(mod.exports.bolehLihatSemua(['regional_head']), true);
// Komentar DIIZINKAN (keputusan Rizki 25 Sep 2026, sesudah tinjauan): Regional Head ikut
// percakapan PO seperti CBO dan Head of Operations. Keputusan verifikasi, tanda tangan, surat,
// PKS, dan sekolah tetap tertutup. Yang menulis nol hanya C Level.
assert.equal(bolehKomentar(['regional_head']), true, 'Regional Head boleh berkomentar');
ok('Regional Head Division: melihat semua termasuk Acquisition, boleh berkomentar, tanpa wewenang keputusan');

// Super Admin justru sebaliknya: melingkupi segalanya.
assert.equal(bolehBuatPo(['admin_utama']), true);
assert.equal(adalahVerifikator(['admin_utama']), true);
assert.equal(adalahLead(['admin_utama']), true);
ok('Super Admin melingkupi seluruh wewenang');

console.log(`\n${n} pemeriksaan lolos.`);
