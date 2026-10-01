// Terbilang tercetak berdampingan dengan angkanya di dokumen yang mengikat
// secara hukum, jadi kekeliruannya harus tertangkap di sini.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(readFileSync(new URL('../lib/terbilang.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { terbilang, rupiahPenuh } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Nilai yang benar-benar muncul di PKS asli
{
  assert.equal(terbilang(75_000_000), 'Tujuh Puluh Lima Juta');
  assert.equal(terbilang(7_500_000), 'Tujuh Juta Lima Ratus Ribu');
  assert.equal(terbilang(22_500_000), 'Dua Puluh Dua Juta Lima Ratus Ribu');
  ok('nilai dari PKS SMKS PGRI 1 Surabaya cocok persis');
}

// Kaidah "se-" yang mudah keliru jadi "satu ..."
{
  assert.equal(terbilang(10), 'Sepuluh');
  assert.equal(terbilang(11), 'Sebelas');
  assert.equal(terbilang(15), 'Lima Belas');
  assert.equal(terbilang(100), 'Seratus');
  assert.equal(terbilang(1_000), 'Seribu');
  assert.equal(terbilang(1_000_000), 'Satu Juta');   // juta TIDAK jadi "Sejuta"
  ok('kaidah se-: sepuluh, sebelas, seratus, seribu, tapi satu juta');
}

// Nol di tengah tidak boleh memunculkan skala kosong
{
  assert.equal(terbilang(1_000_500), 'Satu Juta Lima Ratus');
  assert.equal(terbilang(200_000_000), 'Dua Ratus Juta');
  assert.equal(terbilang(1_020_000), 'Satu Juta Dua Puluh Ribu');
  assert.equal(terbilang(0), 'Nol');
  ok('kelompok bernilai nol dilewati, bukan dieja kosong');
}

// Rentang yang wajar untuk nilai kerja sama
{
  assert.equal(terbilang(1_500_000_000), 'Satu Miliar Lima Ratus Juta');
  assert.equal(terbilang(999), 'Sembilan Ratus Sembilan Puluh Sembilan');
  assert.equal(terbilang(12_345_678),
    'Dua Belas Juta Tiga Ratus Empat Puluh Lima Ribu Enam Ratus Tujuh Puluh Delapan');
  ok('miliar dan angka bercampur dieja utuh');
}

// Format lengkap seperti di PKS
{
  assert.equal(rupiahPenuh(75_000_000), 'Rp 75.000.000,- (Tujuh Puluh Lima Juta Rupiah)');
  ok('format Rp lengkap sama dengan PKS asli');
}

// Pecahan dibulatkan, bukan dieja setengah-setengah
{
  assert.equal(terbilang(1_000.4), 'Seribu');
  ok('nilai berpecahan dibulatkan ke bawah, tidak menghasilkan kata aneh');
}

console.log(`\n${n} pemeriksaan lolos.`);
