// Perhitungan PO berkelompok (spesifikasi 07, langkah 3).
//
// Yang dijaga: PO satu kelompok terhitung PERSIS seperti hitung() hari ini, contoh
// Santamaria terhitung benar dengan pricelist 4.0, dan setiap bentuk yang membuat siswa
// hilang atau terhitung dua kali ditolak.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { KOMPONEN, PRESET } = muat('pricelist');
const { hitung } = muat('hitung');
const { hitungPerKelompok } = muat('kelompok');
const P = (n) => PRESET.find((p) => p.n === n).ids;
const ke = (ids, kelompok = 1, sesi = 1) => ids.map((id) => ({ id, sesi, kelompok }));
const rombel = (kelas, jumlah, kelompok) => ({ kelas, rombel: 'A', jumlah, kelompok });
const dasar = { jumlahGuru: 0, hargaGuru: 0, daftar: KOMPONEN, daftarPaket: PRESET };

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 1. Satu kelompok = hitung() hari ini. Penjaga utama: PO lama tidak boleh berubah.
for (const [nama, ids] of [['LMS Juara', P('LMS Juara')], ['a la carte', ['lms', 'asesmen']],
                          ['paket + add-on', [...P('LMS Smart'), 'konsul']]]) {
  const h1 = hitung(ids.map((id) => ({ id, sesi: 2 })), 90, 0, KOMPONEN, PRESET);
  const r = hitungPerKelompok({ ...dasar, kelompok: [{ nomor: 1, hargaSiswa: 400000 }],
    komponen: ke(ids, 1, 2), rombel: [rombel(10, 30, 1), rombel(11, 30, 1), rombel(12, 30, 1)] });
  assert.deepEqual(r.kelompok[0].hitungan.perSiswa, h1.perSiswa, `${nama}: harga per siswa berbeda dari hitung()`);
  assert.equal(r.kelompok[0].hitungan.paket, h1.paket, `${nama}: paket berbeda`);
  assert.equal(r.kelompok[0].siswa, 90);
  assert.equal(r.grandTotal, 400000 * 90);
  assert.deepEqual(r.masalah, []);
}
ok('satu kelompok terhitung persis seperti hitung() — paket, a la carte, paket + add-on bersesi');

// 2. Santamaria, pricelist 4.0 (lihat koreksi angka di catatan/07).
{
  const r = hitungPerKelompok({ ...dasar,
    kelompok: [{ nomor: 1, nama: 'Kelas 10', hargaSiswa: 279000 },
               { nomor: 2, nama: 'Kelas 11', hargaSiswa: 240000 },
               { nomor: 3, nama: 'Kelas 12', hargaSiswa: 350000 }],
    komponen: [...ke([...P('LMS Smart'), 'asesmen'], 1), ...ke(P('LMS Smart'), 2), ...ke(P('LMS Juara'), 3)],
    rombel: [rombel(10, 100, 1), rombel(11, 100, 2), rombel(12, 100, 3)] });
  assert.deepEqual(r.kelompok.map((k) => k.hitungan.paket), [null, 'LMS Smart', 'LMS Juara']);
  assert.deepEqual(r.kelompok.map((k) => k.hitungan.perSiswa[0]), [279000, 240000, 350000]);
  assert.equal(r.grandTotal, 86_900_000);
  assert.equal(r.kelompok.reduce((a, k) => a + k.lantai * k.siswa, 0), 50_600_000);
  assert.deepEqual(r.masalah, []);
  // Pembanding model A: satu harga paket untuk 300 siswa.
  const a = hitung(ke(P('LMS Juara')), 300, 0, KOMPONEN, PRESET);
  assert.ok(r.grandTotal < a.total[0] && 50_600_000 < a.total[1], 'model C harus lebih murah dan lantainya lebih rendah');
}
ok('Santamaria: paket dicocokkan per kelompok, total Rp86.900.000, lantai Rp50.600.000');

// 3. Jumlah siswa kelompok selalu jumlah rombelnya.
{
  const r = hitungPerKelompok({ ...dasar, kelompok: [{ nomor: 1, hargaSiswa: 100000 }, { nomor: 2, hargaSiswa: 100000 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 2)],
    rombel: [rombel(10, 25, 1), { kelas: 10, rombel: 'B', jumlah: 17, kelompok: 1 }, rombel(12, 8, 2)] });
  assert.deepEqual(r.kelompok.map((k) => [k.siswa, k.kelas]), [[42, [10]], [8, [12]]]);
}
ok('jumlah siswa kelompok diturunkan dari rombel, dan kelasnya ikut tercatat');

// 4. Guru di tingkat PO — dihitung sekali, tidak masuk harga siswa kelompok mana pun.
{
  const r = hitungPerKelompok({ ...dasar, jumlahGuru: 12, hargaGuru: 150000,
    kelompok: [{ nomor: 1, hargaSiswa: 350000 }, { nomor: 2, hargaSiswa: 100000 }],
    komponen: [...ke(P('LMS Juara'), 1), { id: 'guruOff', sesi: 1, kelompok: 1 }, ...ke(['lms'], 2)],
    rombel: [rombel(12, 30, 1), rombel(11, 30, 2)] });
  const tanpaGuru = hitung(ke(P('LMS Juara')), 30, 0, KOMPONEN, PRESET);
  assert.deepEqual(r.kelompok[0].hitungan.perSiswa, tanpaGuru.perSiswa, 'komponen guru bocor ke harga siswa');
  // perSiswa saja tidak cukup: hitung() sudah memisahkan komponen guru ke perGuru, jadi
  // harga siswa tetap benar meski komponen guru ikut masuk kelompok. Yang bocor adalah
  // RINCIAN kelompok — yang nanti dicetak sebagai "Rincian Paket" per kelompok, dan akan
  // mencantumkan Pelatihan Guru di bawah Kelas 12. Uji mutasi pertama lolos karena ini.
  for (const k of r.kelompok) {
    assert.ok(k.hitungan.rincian.every((x) => !x.untukGuru), `rincian ${k.nomor} memuat komponen guru`);
    assert.ok(k.hitungan.perGuru.every((v) => v === 0), `kelompok ${k.nomor} membawa harga guru`);
  }
  assert.ok(r.guru.hitungan.rincian.length === 1 && r.guru.hitungan.rincian[0].untukGuru);
  assert.equal(r.guru.subtotal, 150000 * 12);
  assert.ok(r.guru.lantai > 0);
  assert.equal(r.grandTotal, 350000 * 30 + 100000 * 30 + 150000 * 12);
}
ok('Pelatihan Guru dihitung sekali di tingkat PO, tidak menyusup ke harga maupun rincian kelompok');

// 5. Bentuk yang tidak sah ditolak, dengan kalimat yang bisa ditindaklanjuti.
{
  const tanya = (x) => hitungPerKelompok({ ...dasar, ...x }).masalah.join(' | ');
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }], komponen: ke(['lms']),
    rombel: [rombel(10, 30, 1), rombel(11, 12, 2)] }), /12 siswa di rombel 11-A belum masuk kelompok/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 2, nama: 'Kelas 12', hargaSiswa: 1 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 2)], rombel: [rombel(10, 30, 1)] }), /Kelas 12 belum berisi siswa/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 2, hargaSiswa: 1 }],
    komponen: ke(['lms'], 1), rombel: [rombel(10, 30, 1), rombel(11, 30, 2)] }), /Kelompok 2 belum punya komponen/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 2, hargaSiswa: 1 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 2)], rombel: [rombel(10, 30, 1), rombel(10, 30, 2)] }),
    /Rombel tercatat lebih dari sekali: 10-A/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }], komponen: [...ke(['lms'], 1), ...ke(['asesmen'], 3)],
    rombel: [rombel(10, 30, 1)] }), /asesmen menunjuk kelompok yang tidak ada/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 1, hargaSiswa: 1 }],
    komponen: ke(['lms']), rombel: [rombel(10, 30, 1)] }), /Nomor kelompok ada yang ganda/);
  // Batas po_kelompok di basis data. Tanpa ini simpanDraf baru ditolak SESUDAH menulis
  // baris po dan membasikan persetujuan (temuan QA 12 Sep 2026).
  assert.match(tanya({ kelompok: [{ nomor: 1, nama: 'x'.repeat(61), hargaSiswa: 1 }, { nomor: 2, hargaSiswa: 1 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 2)], rombel: [rombel(10, 30, 1), rombel(11, 30, 2)] }),
    /Nama kelompok maksimal 60 karakter \(kelompok 1\)/);
  assert.doesNotMatch(tanya({ kelompok: [{ nomor: 1, nama: 'x'.repeat(60), hargaSiswa: 1 }, { nomor: 2, hargaSiswa: 1 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 2)], rombel: [rombel(10, 30, 1), rombel(11, 30, 2)] }), /maksimal 60/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 7, hargaSiswa: 1 }],
    komponen: [...ke(['lms'], 1), ...ke(['lms'], 7)], rombel: [rombel(10, 30, 1), rombel(11, 30, 7)] }),
    /Nomor kelompok harus 1 sampai 6/);
  assert.match(tanya({ kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 1.5, hargaSiswa: 1 }],
    komponen: ke(['lms'], 1), rombel: [rombel(10, 30, 1)] }), /Nomor kelompok harus 1 sampai 6/);
  // Label langkah untuk wizard: siswa tak tertagih diperbaiki di Rombel, kelompok tanpa
  // komponen di Paket & harga. Teks pesannya sama dengan `masalah` yang dibaca server.
  const mb = hitungPerKelompok({ ...dasar, kelompok: [{ nomor: 1, hargaSiswa: 1 }, { nomor: 2, hargaSiswa: 1 }],
    komponen: ke(['lms'], 1), rombel: [rombel(10, 30, 1), rombel(11, 30, 2), rombel(12, 5, 3)] });
  assert.deepEqual(mb.masalahBerlangkah.map((m) => m.langkah), ['rombel', 'paket']);
  assert.deepEqual(mb.masalahBerlangkah.map((m) => m.pesan), mb.masalah);
}
ok('siswa tak tertagih, kelompok kosong, tanpa komponen, rombel ganda, nomor ganda, nomor di luar 1–6, dan nama > 60 ditolak');


// 6. Rombel berisi nol tidak dianggap siswa — dan tidak menjadi "tak tertagih".
{
  const r = hitungPerKelompok({ ...dasar, kelompok: [{ nomor: 1, hargaSiswa: 100000 }], komponen: ke(['lms']),
    rombel: [rombel(10, 30, 1), { kelas: 11, rombel: 'B', jumlah: 0, kelompok: 9 }] });
  assert.deepEqual(r.masalah, []);
  assert.equal(r.kelompok[0].siswa, 30);
}
ok('rombel kosong diabaikan, persis seperti form PO hari ini');

console.log(`\n${n} pemeriksaan lolos.`);
