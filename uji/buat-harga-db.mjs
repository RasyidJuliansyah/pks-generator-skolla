// Menghasilkan `supabase/harga-db.sql` dari lib/pricelist.ts.
//
//   node uji/buat-harga-db.mjs          # tulis ulang berkasnya
//   node uji/buat-harga-db.mjs --cek    # bandingkan saja, keluar 1 kalau beda
//
// Kenapa dihasilkan, bukan diketik: trigger lantai di basis data butuh harga, sementara
// pricelist hidup di kode. Menyalin tangan berarti menambah salinan KETIGA yang bisa
// menyimpang diam-diam — dua salinan sudah cukup merepotkan (lihat catatan duplikasi
// kalkulator di lib/pricelist.ts).
//
// ACQUISITION PRICE TIDAK PERNAH IKUT. Berkas ini hanya memuat price list dan bottom
// price. Alasan aturan arsitektur "pricelist tidak masuk DB" seluruhnya tentang
// melindungi acquisition; bottom price sendiri dilihat semua peran
// (lihat lib/po-aksi.ts, "Semua peran melihat Bottom Price").
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const src = readFileSync(new URL('../lib/pricelist.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { KOMPONEN, PRESET, VERSI_PRICELIST } = mod.exports;
// ID_GURU hidup di aturan-komponen.ts sejak 11 Sep 2026 (dipisah dari harga).
const modAturan = { exports: {} };
new Function('module', 'exports', 'require', ts.transpileModule(
  readFileSync(new URL('../lib/aturan-komponen.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
)(modAturan, modAturan.exports, () => ({}));
const { ID_GURU } = modAturan.exports;

const kutip = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const larik = (a) => 'array[' + a.map(kutip).join(', ') + ']';

const komponen = KOMPONEN.map((k) =>
  `  (${kutip(k.id)}, ${k.p[0]}, ${k.p[1]}, ${kutip(k.g)}, ${ID_GURU.includes(k.id)}, ${!!k.sesi})`
).join(',\n');

// `ids` DIURUTKAN supaya pencocokan paket di SQL bisa memakai kesamaan larik.
const paket = PRESET.map((p) =>
  `  (${kutip(p.n)}, ${larik([...p.ids].sort())}, ${p.p[0]}, ${p.p[1]})`
).join(',\n');

const isi = `-- DIHASILKAN OLEH uji/buat-harga-db.mjs — JANGAN DISUNTING TANGAN.
-- Sumber: lib/pricelist.ts, cap versi ${VERSI_PRICELIST}.
--
-- Hanya price list dan bottom price. Acquisition price TIDAK PERNAH masuk basis data.
--
-- Idempoten: dijalankan ulang setiap kali harga berubah.
begin;

delete from harga_komponen;
insert into harga_komponen (id, price_list, bottom, grup, untuk_guru, per_sesi) values
${komponen};

delete from harga_paket;
insert into harga_paket (nama, ids, price_list, bottom) values
${paket};

update pricelist_aktif set versi = ${kutip(VERSI_PRICELIST)}, diperbarui_pada = now();

commit;
`;

const tujuan = new URL('../supabase/harga-db.sql', import.meta.url);
if (process.argv.includes('--cek')) {
  const ada = readFileSync(tujuan, 'utf8');
  if (ada !== isi) {
    console.error('supabase/harga-db.sql TIDAK cocok dengan lib/pricelist.ts.\n'
      + 'Jalankan: node uji/buat-harga-db.mjs, lalu terapkan ke basis data.');
    process.exit(1);
  }
  console.log('  OK  supabase/harga-db.sql cocok dengan lib/pricelist.ts');
} else {
  writeFileSync(tujuan, isi);
  console.log('supabase/harga-db.sql ditulis ulang dari lib/pricelist.ts');
}
