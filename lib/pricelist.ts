/**
 * Harga hidup di sini, BUKAN di basis data.
 *
 * Postgres tidak punya keamanan tingkat kolom yang praktis. Menyimpan Acquisition
 * Price di tabel berarti bergantung pada view berlapis yang gampang bocor begitu
 * ada yang menambah kueri baru. Di sini, penyaringan per peran terjadi sebelum
 * data meninggalkan server.
 *
 * SYARATNYA: berkas ini tidak boleh terjangkau dari komponen klien. Sampai 11 Sep 2026
 * ia terjangkau — form PO -> hitung.ts -> KOMPONEN — dan seluruh larik, termasuk
 * Acquisition, ikut terkirim ke peramban setiap pembuka form PO. Kalimat yang dulu
 * tertulis di sini, "kebocoran mustahil secara struktur", keliru. Sekarang dijaga
 * `uji/batas-harga.test.mjs` (graf impor) dan `uji/pindai-bundel.mjs` (chunk build).
 * Aturan tanpa harga yang dibutuhkan klien hidup di `aturan-komponen.ts`.
 *
 * Berkas ini DUPLIKAT dari `skolla-pricing-calculator/api/data.js`. Kalkulator lama
 * sengaja dibiarkan berdiri sendiri sebagai cadangan bila sistem ini bermasalah.
 * Konsekuensinya: setiap perubahan harga WAJIB dilakukan di kedua tempat — begitu pula
 * MIN_PESERTA dan ID_GURU, yang sejak 11 Sep 2026 hidup di `aturan-komponen.ts`.
 * Sejak 22 Sep 2026 KAPASITAS_SESI juga berlaku di kedua aplikasi, bukan hanya di sini.
 * Cap versi di bawah dihitung dari id + price list + bottom price — SENGAJA tanpa
 * Acquisition Price. Cap ini tersimpan di `po.versi_pricelist` dan ikut terbit di
 * respons publik kalkulator lama; kalau acquisition ikut di-hash, sebuah nilai
 * turunan darinya melewati batas "tidak pernah masuk basis data". Harganya: cap
 * TIDAK mendeteksi kalau yang berubah cuma acquisition. Itu diterima — yang bergerak
 * di praktiknya bottom price. Kalau berbeda antara dua aplikasi,
 * berarti salah satunya tertinggal. `uji/pricelist.test.mjs` menghitung ulang cap
 * ini dari KOMPONEN — jadi cap yang lupa diperbarui jatuh di sini, bukan diam-diam
 * lolos. Yang TIDAK bisa dijaga dari sini: apakah kalkulator lama ikut diperbarui.
 */

export const VERSI_PRICELIST = 'af4fc50e4ac9';

export type Komponen = {
  id: string;
  s: string;
  g: 'core' | 'addon';
  n: string;
  p: (number | null)[];
  sesi?: boolean;
  note?: string;
};

export type Preset = { n: string; ids: string[]; p: number[] };

// Sumber: "Pricelist Skolla 2026 4.0" / tab "Skolla Pricelist 2026 IV" (4 Sep 2026),
// kolom IoM — rekonsiliasi Finance vs IoM yang dimenangkan IoM.
// p: [price list, bottom price, acquisition price]
// Kelima add-on per sesi dikonfirmasi ulang oleh 4.0: selisih Finance-vs-IoM-nya Rp0.
export const KOMPONEN: Komponen[] = [
  { id: 'lms', s: 'LMS', g: 'core', n: 'Learning Management System', p: [100000, 66000, 43000] },
  { id: 'modul', s: 'Modul', g: 'core', n: 'Bimbel Online — Modul Pembelajaran', p: [15000, 11000, 7000] },
  { id: 'video', s: 'Video', g: 'core', n: 'Bimbel Online — Video Pembelajaran', p: [29000, 19000, 13000] },
  { id: 'soal', s: 'Latihan Soal', g: 'core', n: 'Bimbel Online — Latihan Soal', p: [60000, 39000, 25000] },
  { id: 'asesmen', s: 'Asesmen Psikolog', g: 'core', n: 'Asesmen Psikolog', p: [75000, 50000, 10000] },
  { id: 'tryout', s: 'Tryout', g: 'core', n: 'Tryout (TO TKA / TO SNBT)', p: [25000, 20000, 9000] },
  { id: 'live', s: 'Live Class', g: 'core', n: 'Live Class', p: [32000, 21000, 14000] },
  { id: 'snbp', s: 'Analisis SNBP', g: 'core', n: 'Analisis SNBP', p: [4000, 3000, 2000] },
  { id: 'konsul', s: 'Konsultasi Online', g: 'addon', n: 'Konsultasi Online', p: [52000, 34000, 22000], sesi: true, note: '30 menit / sesi' },
  { id: 'pendam', s: 'Pendalaman Materi', g: 'addon', n: 'Pendalaman Materi (offline)', p: [45000, 28000, 19000], sesi: true, note: '90 menit · min. 30 siswa / rombel' },
  { id: 'pmOn', s: 'PM Online', g: 'addon', n: 'Pendalaman Materi (online)', p: [32000, 21000, 14000], sesi: true, note: 'per sesi · rekomendasi 30 siswa / sesi · harga mengikuti Live Class' },
  { id: 'psiOff', s: 'Psikolog Klasikal · off', g: 'addon', n: 'Psikolog Klasikal (offline)', p: [150000, 91000, 60000], sesi: true, note: '90 menit · 10–30 siswa' },
  { id: 'psiOn', s: 'Psikolog Klasikal · on', g: 'addon', n: 'Psikolog Klasikal (online)', p: [95000, 56000, 37000], sesi: true, note: '90 menit · 10–30 siswa' },
  { id: 'guruOff', s: 'Pelatihan Guru · off', g: 'addon', n: 'Pelatihan Guru (offline)', p: [150000, 82000, 54000], sesi: true, note: '60 menit · 10–30 peserta' },
  { id: 'guruOn', s: 'Pelatihan Guru · on', g: 'addon', n: 'Pelatihan Guru (online)', p: [50000, 23000, 15000], sesi: true, note: '60 menit · 10–30 peserta' },
];

// Komposisi paket dari tab "Checklist Fitur"; dua paket Bimbel direkonstruksi dari angka paketnya.
//
// DUA MEKANISME HARGA, dan yang menentukan adalah ISI, bukan tombol yang ditekan:
//   · susunan komponennya persis sebuah paket -> harga paket `p` di bawah (angka IoM,
//     tab "Skolla Package 2026 Paket Penjualan")
//   · susunan lain -> jumlah harga komponen menurut pricelist 4.0
// Karena modenya diturunkan dari isi, mustahil ada dua PO berisi sama dengan harga
// berbeda — jadi identitas paket tidak perlu disimpan di basis data, cukup dihitung.
//
// `p` sengaja BUKAN jumlah komponennya: tiap paket punya diskon bundelnya sendiri, dan
// angka paket memang tidak bisa diurai jadi harga komponen (LMS bernilai 100.000 satuan
// tapi 65.000 di dalam LMS Juara). Add-on per sesi tetap ditambahkan DI ATAS harga paket.
export const PRESET: Preset[] = [
  { n: 'LMS Juara', ids: ['lms', 'modul', 'video', 'soal', 'asesmen', 'tryout', 'live', 'snbp'], p: [350000, 186000, 123000] },
  { n: 'LMS Smart', ids: ['lms', 'modul', 'video', 'soal'], p: [240000, 135000, 88000] },
  { n: 'LMS Lite', ids: ['lms'], p: [100000, 66000, 43000] },
  { n: 'Bimbel UTBK/TKA Premium', ids: ['modul', 'video', 'soal', 'asesmen', 'tryout', 'live', 'snbp'], p: [285000, 120000, 80000] },
  { n: 'Bimbel UTBK/TKA Lite', ids: ['modul', 'video', 'soal', 'asesmen', 'tryout', 'snbp'], p: [150000, 99000, 66000] },
  { n: 'Asesmen Psikologi', ids: ['asesmen'], p: [75000, 50000, 10000] },
  { n: 'Tryout', ids: ['tryout'], p: [25000, 20000, 9000] },
];

export const NAMA_TIER = ['Price List', 'Bottom Price', 'Acquisition Price'] as const;

/** Berapa tier yang boleh diterima peran ini. Acquisition dipotong di server. */
export function jumlahTier(bolehAcquisition: boolean) {
  return bolehAcquisition ? 3 : 2;
}

export function komponenUntuk(bolehAcquisition: boolean): Komponen[] {
  const n = jumlahTier(bolehAcquisition);
  return KOMPONEN.map((k) => ({ ...k, p: k.p.slice(0, n) }));
}

/**
 * Harga paket, dipotong per peran PERSIS seperti komponen. Wajib dipakai di setiap
 * tempat yang mengirim PRESET ke klien: sejak paket membawa harganya sendiri, PRESET
 * mentah ikut mengangkut acquisition price melewati batas server.
 */
export function presetUntuk(bolehAcquisition: boolean): Preset[] {
  const n = jumlahTier(bolehAcquisition);
  return PRESET.map((p) => ({ ...p, p: p.p.slice(0, n) }));
}

