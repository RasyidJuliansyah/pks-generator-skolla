// Syarat maju IoM, dibaca dari berkas migrasinya sendiri. Perilakunya dibuktikan langsung
// di basis data dalam transaksi yang dibatalkan (catatan/14 Tugas 2); uji ini menangkap
// saat seseorang kelak "merapikan" migrasinya dan diam-diam membuka pintu yang ditutup.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';
import { migrasiTerakhir } from './migrasi.mjs';

const sql = readFileSync(new URL('../supabase/migrasi/20260917_syarat_maju_iom.sql', import.meta.url), 'utf8');
const { VERSI_IOM } = muat('iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };
const badan = sql.slice(sql.indexOf('function private.jaga_syarat_maju'), sql.indexOf('create trigger po_syarat_maju'));

// Versinya ikut migrasi TERAKHIR yang mendefinisikan versi_iom_berlaku, bukan berkas ini:
// setiap kenaikan versi menulis ulang fungsi itu di migrasi baru.
const versiSql = migrasiTerakhir(/function private\.versi_iom_berlaku/).isi;
assert.match(versiSql, new RegExp(`select '${VERSI_IOM}'::text`));
ok('versi di basis data sama dengan VERSI_IOM di lib/iom.ts');

assert.ok('po_syarat_maju' > 'po_bekukan_sekolah');
assert.match(sql, /create trigger po_syarat_maju before insert or update on po/);
ok('trigger berjalan sesudah po_bekukan_sekolah, pada insert dan update');

assert.match(badan, /new\.versi_iom := private\.versi_iom_berlaku\(\)/);
assert.match(badan, /new\.versi_iom is distinct from old\.versi_iom/);
assert.match(sql, /add column if not exists versi_iom text;/);
ok('stempel diisi trigger, tanpa default kolom, dan tidak bisa diubah');

assert.match(badan, /old\.status not in \('draf', 'ditolak'\) or new\.status in \('draf', 'ditolak'\)/);
ok('syarat hanya pada transisi keluar draf');

const iB = badan.indexOf('if new.versi_iom is not null');
assert.ok(iB > 0 && badan.indexOf('if v_n = 0') > 0 && badan.indexOf('if v_n = 0') < iB);
ok('syarat termin berlaku untuk semua PO, sebelum cabang PO berstempel');

for (const k of ['new.masa_mulai is null', 'new.masa_selesai <= new.masa_mulai', "('npsn'",
  "('kepala_sekolah'", "('kepsek_hp'", "('bendahara'", "('bendahara_hp'"])
  assert.ok(badan.indexOf(k) > iB, `${k} tidak di cabang berstempel`);
ok('masa aktif dan kelima isian sekolah hanya untuk PO berstempel');

const beku = sql.slice(sql.indexOf('function private.bekukan_isi_po'));
assert.match(beku, /NEW\.permintaan_tambahan, NEW\.versi_iom\)/);
assert.match(beku, /OLD\.permintaan_tambahan, OLD\.versi_iom\)/);
ok('permintaan_tambahan dan versi_iom ikut dibekukan');

console.log(`\n${n} pemeriksaan lolos.`);
