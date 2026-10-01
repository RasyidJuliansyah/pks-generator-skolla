// Kiriman form PO ke simpanDraf tidak boleh berubah saat form menjadi wizard
// (catatan/11). Direkam dari penyusun yang dipindah apa adanya dari simpan()
// di form-po.tsx.
//
//   BUAT_EMAS=1 node uji/isi-po.test.mjs   hanya bila perubahan kiriman memang disengaja,
//   lalu periksa diff uji/emas/isi-po-*.json baris per baris.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { susunIsiPo } = muat('isi-po-form');
const lain = { masaMulai: '2026-09-01', masaSelesai: '2027-08-31', sumberDana: 'BOS', sumberDanaLain: '',
  kota: 'Bekasi', tanggalTtd: '2026-09-12', namaPm: 'Agung Uji', namaSm: 'Zhurry Uji',
  cat1: 'Mulai semester ganjil.', cat2: '', permintaanTambahan: false };
const sekolah = { nama: 'SMA UJI', npsn: '20200001', jenjang: 'SMA', kepala_sekolah: 'Kepala Uji' };
const rombel = { '10-A': 100, '11-A': 100, '12-A': 60, '12-B': 40 };
const dasar = { awalId: 'po-1', adaAwal: true, pindaian: false, sekolah, lain, nRombel: 2,
  barisKelas: [10, 11, 12], kolomRombel: ['A', 'B'], rombel, guru: 20, hGuru: 150000,
  termin: [{ urutan: 1, tanggal: '2026-09-15', nominal: 0 }, { urutan: 2, tanggal: '', nominal: 0 }] };

const KASUS = {
  satu: { ...dasar, asal: 'platform', kelompok: null, komponenKelompok: [], nomorKelompok: [],
    pilihan: [{ id: 'lms', sesi: 1 }, { id: 'guruOff', sesi: 2 }], nSiswa: 300, hSiswa: 240000,
    kelompokKelas: () => 1 },
  berkelompok: { ...dasar, asal: 'platform', pilihan: [{ id: 'guruOff', sesi: 2 }], nSiswa: 300, hSiswa: 0,
    kelompok: [{ nomor: 1, nama: ' ', hargaSiswa: 279000 }, { nomor: 3, nama: 'Kelas 12', hargaSiswa: 350000 }],
    nomorKelompok: [1, 3],
    komponenKelompok: [{ id: 'lms', sesi: 1, kelompok: 1 }, { id: 'tryout', sesi: 1, kelompok: 3 },
      { id: 'asesmen', sesi: 1, kelompok: 2 }, { id: 'guruOff', sesi: 2, kelompok: 1 }],
    kelompokKelas: (k) => (k === 12 ? 3 : 1) },
  // Unggahan sering diisi separuh: masa mulai kosong harus terkirim sebagai TIDAK ADA, bukan ''.
  // Bendera b4 (catatan/13a Bagian 7) ikut direkam dalam kedua nilainya.
  unggahan: { ...dasar, lain: { ...lain, masaMulai: '', permintaanTambahan: true }, awalId: undefined, adaAwal: false, pindaian: true, asal: 'unggahan', kelompok: null,
    komponenKelompok: [], nomorKelompok: [], pilihan: [{ id: 'lms', sesi: 1 }], nSiswa: 300, hSiswa: 100000,
    kelompokKelas: () => 1 },
};

const buat = process.env.BUAT_EMAS === '1';
for (const [nama, masukan] of Object.entries(KASUS)) {
  const hasil = JSON.stringify(susunIsiPo(masukan), null, 2) + '\n';
  const jalur = new URL(`./emas/isi-po-${nama}.json`, import.meta.url);
  if (buat) { writeFileSync(jalur, hasil); continue; }
  assert.equal(hasil, readFileSync(jalur, 'utf8'), `kiriman ${nama} berubah dari rekaman`);
  console.log(`  OK  kiriman ${nama} identik dengan rekaman`);
}
// Rekaman tidak memuat PO lama dengan pindaian baru; server membatalkan pernyataan
// kesesuaian berdasarkan tanda ini, jadi diperiksa terpisah.
if (!buat) {
  assert.equal(susunIsiPo({ ...KASUS.satu, pindaian: true }).pindaianBaru, true, 'PO lama + pindaian baru');
  assert.equal(susunIsiPo(KASUS.unggahan).pindaianBaru, false, 'PO baru tidak menandai pindaian baru');
  console.log('  OK  pindaianBaru hanya untuk PO lama dengan pindaian baru');
}
// Golden kiriman tidak berubah karena bidang baru (catatan/23): namaRh kosong dan
// formKertasLama tidak dicentang tidak menambah kunci apa pun.
if (!buat) {
  const isi = susunIsiPo({ ...KASUS.satu, lain: { ...KASUS.satu.lain, namaRh: '' }, formKertasLama: false });
  assert.equal(isi.namaRh, undefined);
  assert.ok(!('formKertasLama' in isi));
  assert.equal(susunIsiPo({ ...KASUS.unggahan, formKertasLama: true }).formKertasLama, true);
  // PO platform dan PO yang sudah ada tidak pernah mengirimnya.
  assert.ok(!('formKertasLama' in susunIsiPo({ ...KASUS.satu, formKertasLama: true })));
  assert.equal(susunIsiPo({ ...KASUS.satu, lain: { ...KASUS.satu.lain, namaRh: 'RH Uji' } }).namaRh, 'RH Uji');
  console.log('  OK  namaRh dan formKertasLama hanya terkirim bila terisi');
}
console.log(buat ? 'rekaman kiriman ditulis' : '\n5 pemeriksaan lolos.');
