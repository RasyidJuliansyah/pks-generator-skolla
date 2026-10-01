// Menguji inti perhitungan terhadap angka yang sudah diverifikasi di kalkulator lama.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Kompilasi ringkas: buang anotasi tipe TS agar bisa dijalankan node langsung.
import { muat } from './muat.mjs';
const H = muat('hitung');
const PRICELIST = muat('pricelist');
const { KOMPONEN, PRESET } = PRICELIST;
const pil = (ids, sesi = 1) => ids.map((id) => ({ id, sesi }));
let n = 0;
const ok = (label) => { console.log('  OK  ' + label); n++; };

// 1. LMS Juara 30 siswa — angka yang sudah diverifikasi di kalkulator lama
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  const h = H.hitung(pil(juara), 30, 0, KOMPONEN, PRESET);
  assert.deepEqual(h.perSiswa, [350000, 186000, 123000]);
  assert.deepEqual(h.total, [10500000, 5580000, 3690000]);
  assert.equal(h.paket, 'LMS Juara');
  ok('LMS Juara utuh → harga paket Rp350.000 / siswa, lantai Rp186.000');
}

// 1b. Susunan yang BUKAN paket dihargai a la carte: jumlah komponen 4.0.
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  const kurang = juara.filter((id) => id !== 'snbp');
  const h = H.hitung(pil(kurang), 1, 0, KOMPONEN, PRESET);
  assert.equal(h.paket, null, 'tanpa satu komponen, ini bukan paket lagi');
  const jumlah = kurang.reduce((a, id) => a + KOMPONEN.find((k) => k.id === id).p[1], 0);
  assert.equal(h.perSiswa[1], jumlah);
  ok('susunan bukan-paket dihargai a la carte, jumlah komponen 4.0');
}

// 1c. TEBING-nya dikunci. Melepas Analisis SNBP — bottom-nya cuma 3.000 — menaikkan
// lantai dari 186.000 ke 226.000 karena susunannya berhenti jadi paket. Ini melekat
// pada harga bundel, bukan bug, tapi angkanya tidak boleh bergeser diam-diam: Sales
// diberi tahu persis selisih ini di layar.
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  const utuh = H.hitung(pil(juara), 1, 0, KOMPONEN, PRESET);
  const tanpa = H.hitung(pil(juara.filter((id) => id !== 'snbp')), 1, 0, KOMPONEN, PRESET);
  assert.equal(utuh.perSiswa[1], 186000);
  assert.equal(tanpa.perSiswa[1], 226000);
  assert.equal(tanpa.perSiswa[1] - utuh.perSiswa[1], 40000);
  ok('tebing terkunci: lepas Analisis SNBP → lantai naik Rp40.000');
}

// 1d. Paket + add-on per sesi: harga paket tetap berlaku, add-on ditambah di atasnya.
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  const h = H.hitung([...pil(juara), { id: 'konsul', sesi: 2 }], 1, 0, KOMPONEN, PRESET);
  assert.equal(h.paket, 'LMS Juara');
  assert.equal(h.perSiswa[0], 350000 + 52000 * 2);
  ok('paket + add-on: add-on tidak membatalkan harga paket');
}

// 1e. Paket yang di 4.0 sudah identik dengan komponennya: mode tidak mengubah apa pun.
for (const [nama, id] of [['Asesmen Psikologi', 'asesmen'], ['Tryout', 'tryout'], ['LMS Lite', 'lms']]) {
  const h = H.hitung([{ id, sesi: 1 }], 1, 0, KOMPONEN, PRESET);
  const k = KOMPONEN.find((x) => x.id === id);
  assert.equal(h.paket, nama);
  assert.deepEqual(h.perSiswa, k.p, `${nama}: harga paket harus sama dengan komponennya`);
}
ok('tiga paket satu-komponen identik di kedua mekanisme');

// 1f. Nama paket di DOKUMEN harus mengikuti aturan yang sama dengan penentu HARGA.
// Dulu dokumen memakai presetCocok (menuntut seluruh pilihan sama), sehingga PO yang
// dihargai sebagai paket bisa tercetak "Paket Custom" di lembar yang ditandatangani
// sekolah. Sekarang keduanya memanggil paketDari yang sama.
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  for (const sel of [pil(juara),
                     [...pil(juara), { id: 'konsul', sesi: 2 }],
                     [...pil(juara), { id: 'guruOff', sesi: 1 }],
                     pil(['lms', 'video', 'live'])]) {
    const h = H.hitung(sel, 1, 0, KOMPONEN, PRESET);
    const dok = H.paketDari(sel, KOMPONEN, PRESET);
    assert.equal(h.paket, dok?.n ?? null,
      `harga bilang ${h.paket}, dokumen bilang ${dok?.n ?? null} — dua aturan berbeda`);
  }
  ok('nama paket di dokumen selalu sama dengan yang menentukan harga');
}

// 2. Guru dihitung terpisah, bukan dikali jumlah siswa
{
  const juara = PRESET.find((p) => p.n === 'LMS Juara').ids;
  const h = H.hitung([...pil(juara), { id: 'guruOff', sesi: 1 }], 30, 12, KOMPONEN, PRESET);
  assert.deepEqual(h.perSiswa, [350000, 186000, 123000]);
  assert.deepEqual(h.perGuru, [150000, 82000, 54000]);
  assert.equal(h.total[0], 350000 * 30 + 150000 * 12);
  ok('Pelatihan Guru ikut jumlah guru, bukan siswa');
}

// 3. Sesi mengalikan harga komponen per-sesi
{
  const h = H.hitung([{ id: 'pmOn', sesi: 3 }], 30, 0, KOMPONEN, PRESET);
  assert.deepEqual(h.perSiswa, [32000 * 3, 21000 * 3, 14000 * 3]);
  ok('3 sesi PM Online = 3x harga satuan');
}

// 4. Tier dipotong untuk peran tanpa Acquisition
{
  const potong = PRICELIST.komponenUntuk(false);
  const paketPotong = PRICELIST.presetUntuk(false);
  const h = H.hitung([{ id: 'lms', sesi: 1 }], 10, 0, potong, paketPotong);
  assert.equal(h.perSiswa.length, 2, 'peran sales hanya menerima 2 tier');
  assert.deepEqual(h.perSiswa, [100000, 66000]);
  // Sejak paket membawa harganya sendiri, PRESET mentah ikut mengangkut acquisition
  // price ke klien. presetUntuk() yang memotongnya — dijaga di sini supaya tidak lolos.
  assert.ok(paketPotong.every((p) => p.p.length === 2),
    'presetUntuk(false) masih membocorkan acquisition price paket');
  ok('Acquisition Price tidak ikut untuk peran sales, komponen maupun paket');
}

// 5. Batas minimal peserta
{
  assert.equal(H.langgarMinimum(pil(['live']), 29, 0, KOMPONEN).length, 1);
  assert.equal(H.langgarMinimum(pil(['live']), 30, 0, KOMPONEN).length, 0);
  const g = H.langgarMinimum(pil(['guruOff']), 500, 4, KOMPONEN);
  assert.equal(g.length, 1);
  assert.equal(g[0].satuan, 'guru', 'Pelatihan Guru dinilai dari jumlah guru');
  ok('Batas minimal: 29 ditolak, 30 lolos, guru dinilai dari guru');
}

// 6. Kapasitas 30 per sesi — kebocoran yang ditambal
{
  const kurang = H.langgarKapasitas([{ id: 'psiOff', sesi: 1 }], 900, 0, KOMPONEN);
  assert.equal(kurang.length, 1);
  assert.equal(kurang[0].butuh, 30, '900 siswa butuh 30 sesi');
  const cukup = H.langgarKapasitas([{ id: 'psiOff', sesi: 30 }], 900, 0, KOMPONEN);
  assert.equal(cukup.length, 0);
  const guru = H.langgarKapasitas([{ id: 'guruOn', sesi: 1 }], 900, 45, KOMPONEN);
  assert.equal(guru[0].butuh, 2, '45 guru butuh 2 sesi');
  ok('Kapasitas: 900 siswa butuh 30 sesi, 45 guru butuh 2 sesi');
}

// 7. Harga kosong tidak dianggap nol
{
  const palsu = [{ id: 'x', s: 'X', g: 'addon', n: 'X', p: [50000, null, null] }];
  const h = H.hitung([{ id: 'x', sesi: 1 }], 10, 0, palsu, PRESET);
  assert.equal(h.perSiswa[0], 50000);
  assert.equal(h.perSiswa[1], 0);
  assert.deepEqual(h.belumLengkap[1], ['X']);
  ok('Harga kosong ditandai, bukan dijumlah sebagai nol');
}

// 8. Batas bawah input
{
  assert.equal(H.batasBawahPeserta(pil(['live', 'psiOff']), 'siswa'), 30);
  assert.equal(H.batasBawahPeserta(pil(['guruOff']), 'guru'), 10);
  assert.equal(H.batasBawahPeserta(pil(['lms']), 'siswa'), 1);
  ok('Batas bawah input mengambil aturan paling ketat');
}

console.log(`\n${n} pemeriksaan lolos.`);
