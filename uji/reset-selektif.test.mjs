// Memastikan pemetaan reset sesuai keputusan: bidang yang berubah hanya
// membatalkan persetujuan fungsi yang wilayahnya tersentuh.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const src = readFileSync(new URL('../lib/checklist.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { fungsiTerdampak, isianBerubah, tandaDaftar, URUT_FUNGSI, CHECKLIST } = mod.exports;

const sama = (a, b) => assert.deepEqual(a.slice().sort(), b.slice().sort());

sama(fungsiTerdampak(['harga_siswa']), ['finance']);
console.log('  OK  harga berubah → hanya Finance');

sama(fungsiTerdampak(['termin']), ['finance']);
console.log('  OK  termin berubah → hanya Finance');

sama(fungsiTerdampak(['komponen']), ['education', 'tech_ops', 'service_account']);
console.log('  OK  komponen berubah → Education, Tech Ops, Service Account');

sama(fungsiTerdampak(['masa_selesai']), ['service_account']);
console.log('  OK  masa aktif berubah → hanya Service Account');

sama(fungsiTerdampak(['sekolah']), ['education', 'tech_ops', 'service_account']);
console.log('  OK  sekolah berubah → tiga fungsi');

sama(fungsiTerdampak(['kepala_sekolah']), ['education', 'tech_ops', 'service_account']);
console.log('  OK  kepala sekolah berubah → tiga fungsi');

sama(fungsiTerdampak(['jenjang']), ['education', 'tech_ops', 'service_account']);
console.log('  OK  jenjang berubah → tiga fungsi');

sama(fungsiTerdampak(['sumber_dana']), ['finance']);
console.log('  OK  sumber dana berubah → hanya Finance');

sama(fungsiTerdampak(['sponsorship']), ['finance']);
console.log('  OK  catatan sponsorship berubah → hanya Finance');

// b4 (permintaan penambahan produk) milik Tech Ops (catatan/13a Bagian 7).
sama(fungsiTerdampak(['permintaan_tambahan']), ['tech_ops']);
console.log('  OK  permintaan tambahan berubah → hanya Tech Ops');

// Isian tidak dikirim tidak menyentuh kolomnya, jadi tidak boleh terhitung berubah.
assert.equal(isianBerubah('Mugan', undefined), false);
console.log('  OK  isian tidak dikirim → tidak berubah');

// Isian yang dikosongkan terkirim sebagai '' padahal tersimpan null; spasi di tepi
// bukan perubahan isi.
assert.equal(isianBerubah(null, ''), false);
assert.equal(isianBerubah(null, '   '), false);
assert.equal(isianBerubah(' Mugan ', 'Mugan'), false);
console.log('  OK  kosong, null, dan spasi → sama');

assert.equal(isianBerubah('Mugan', 'Budi'), true);
assert.equal(isianBerubah(null, 'Budi'), true);
assert.equal(isianBerubah('Mugan', ''), true);
console.log('  OK  isian diganti, diisi, atau dikosongkan → berubah');

// Daftar rombel/catatan dibandingkan seperti tersimpan: urutan dan spasi bukan isi.
assert.equal(tandaDaftar([[7, 'A', 30], [8, 'B', 25]]), tandaDaftar([[8, 'B', 25], [7, 'A', 30]]));
assert.equal(tandaDaftar([['pelaksanaan', ' x ']]), tandaDaftar([['pelaksanaan', 'x']]));
assert.equal(tandaDaftar([[7, 'A', null]]), tandaDaftar([[7, 'A', '']]));
console.log('  OK  urutan, spasi, dan null di daftar → tidak berubah');

assert.notEqual(tandaDaftar([[7, 'A', 30]]), tandaDaftar([[7, 'A', 31]]));
assert.notEqual(tandaDaftar([[7, 'A', 30]]), tandaDaftar([]));
assert.notEqual(tandaDaftar([[7, 'A', 30], [7, 'A', 30]]), tandaDaftar([[7, 'A', 30]]));
console.log('  OK  nilai diganti, baris hilang, atau baris ganda → berubah');

sama(fungsiTerdampak([]), []);
console.log('  OK  tidak ada yang berubah → tidak ada yang direset');

sama(fungsiTerdampak(['harga_siswa', 'komponen']), URUT_FUNGSI);
console.log('  OK  harga + komponen berubah → keempatnya');

// tiap fungsi punya daftar periksa yang tidak kosong
for (const f of URUT_FUNGSI) {
  assert.ok(CHECKLIST[f].item.length > 0, `${f} tidak punya item periksa`);
}
console.log(`  OK  keempat fungsi punya daftar periksa`);
console.log('\n17 pemeriksaan lolos.');
