// Nama kunci penyedia dan hostnya TIDAK boleh muncul di kode yang dikirim ke peramban, modul
// klien tidak boleh mengimpor berkas penyedia, dan nama model yang dipakai klien harus sama
// dengan yang dipaku basis data.
//
// Pengganti cepat untuk uji/pindai-bundel.mjs, yang butuh build; keduanya dijalankan di Tugas 11.
// Daftar terlarangnya DITURUNKAN dari lib/penyedia-ekstraksi.ts (uji/terlarang-klien.mjs), bukan
// dipatok, supaya penjaga ini tidak berhenti menjaga saat host atau modelnya berganti.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { terlarangKlien } from './terlarang-klien.mjs';
import { migrasiTerakhir } from './migrasi.mjs';

const AKAR = new URL('..', import.meta.url).pathname;
const { kunci, model, host } = terlarangKlien();
const TERLARANG = [kunci, model, ...host];

const berkas = [];
(function jalan(d) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) jalan(p);
    else if (/\.(ts|tsx)$/.test(n)) berkas.push(p);
  }
})(join(AKAR, 'app'), join(AKAR, 'lib'));

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 'use client' pada baris pertama = komponen klien; seluruh graf impornya sampai ke peramban.
const isiKlien = berkas
  .map((f) => ({ f, s: readFileSync(f, 'utf8') }))
  .filter(({ s }) => /^\s*['"]use client['"]/m.test(s.slice(0, 200)));
assert.ok(isiKlien.length > 0, 'tidak ada berkas klien terdeteksi; pemeriksa ini rusak');

const pelanggar = isiKlien.filter(({ s }) => /penyedia-ekstraksi/.test(s)).map(({ f }) => f);
assert.deepEqual(pelanggar, [], 'komponen klien mengimpor modul penyedia:\n  ' + pelanggar.join('\n  '));
ok(`${isiKlien.length} berkas klien tidak mengimpor modul penyedia`);

const bocor = [];
for (const { f, s } of isiKlien) {
  for (const t of TERLARANG) if (s.includes(t)) bocor.push(`${f.slice(AKAR.length)} memuat ${t}`);
}
assert.deepEqual(bocor, [], 'nama kunci, host, atau model penyedia ada di berkas klien:\n  ' + bocor.join('\n  '));
ok(`nama kunci, ${host.length} host, dan nama model tidak ada di berkas klien mana pun`);

// Nama model dipaku di DUA tempat: private.model_ekstraksi() di basis data (yang tercatat di
// setiap baris pembacaan) dan konstanta di modul penyedia (yang benar-benar dikirim ke penyedia).
// Kalau keduanya berbeda, catatan auditnya menyebut model yang tidak dipakai.
const sql = migrasiTerakhir(/function private\.model_ekstraksi/).isi;
const dipaku = sql.match(/select '([^']+)'::text/)?.[1];
assert.equal(dipaku, model,
  `model di basis data (${dipaku}) berbeda dari konstanta aplikasi (${model})`);
ok('nama model sama di basis data dan di modul penyedia');

console.log(`\n${n} pemeriksaan lolos.`);
