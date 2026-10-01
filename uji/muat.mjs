// Pemuat modul lib/*.ts untuk uji dan pratinjau berbasis node — SATU untuk semua.
//
// Dulu tiap uji punya pemuat tulisan tangan dengan peta `sumber` yang diisi manual,
// dan setiap modul baru di lib/ membuatnya pecah dengan "Cannot find module": dua kali
// dalam dua hari (./kelas 10 Sep, ./aturan-komponen 11 Sep). Pemuat ini menyelesaikan
// impor relatif secara rekursif, jadi modul baru tidak perlu didaftarkan di mana pun.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require_ = createRequire(import.meta.url);
const cache = {};

/** `muat('hitung')` memuat lib/hitung.ts berikut semua impor relatifnya. */
export function muat(nama) {
  nama = nama.replace(/^(\.\.\/)?lib\//, '').replace(/\.tsx?$/, '');
  if (cache[nama]) return cache[nama].exports;
  const m = { exports: {} };
  cache[nama] = m;
  const js = ts.transpileModule(readFileSync(new URL(`../lib/${nama}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', js)(m, m.exports,
    (p) => (p.startsWith('./') ? muat(p.slice(2)) : require_(p)));
  return m.exports;
}
