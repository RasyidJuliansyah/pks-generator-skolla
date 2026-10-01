/**
 * Status PO beserta pembagiannya ke dua menu.
 *
 * Daftar PO berhenti di 'terverifikasi'; sejak PKS terbit, PO pindah ke menu
 * Perjanjian (PKS) — mengikuti pemisahan yang sama seperti dokumennya. Definisi
 * ini ditaruh di satu tempat supaya kedua menu tidak pernah menampilkan status
 * yang sama atau melewatkan satu pun.
 */

/** `warna` adalah NAMA token, bukan nilai CSS: komponen memakainya sebagai
 *  kelas `w-<nama>` yang diwarnai stylesheet. Meneruskan nilai warna lewat
 *  inline style tidak jalan di semua peramban. */
export type StatusPo = { kode: string; label: string; warna: string };

/** Urutan mengikuti perjalanan PO, bukan abjad — supaya terbaca sebagai alur. */
export const TAHAP_PO: StatusPo[] = [
  { kode: 'draf',           label: 'Draf',           warna: 'draf' },
  { kode: 'menunggu_ttd',   label: 'Menunggu TTD',   warna: 'menunggu-ttd' },
  { kode: 'ditandatangani', label: 'Ditandatangani', warna: 'ditandatangani' },
  { kode: 'verifikasi',     label: 'Verifikasi',     warna: 'verifikasi' },
  { kode: 'ditolak',        label: 'Ditolak',        warna: 'ditolak' },
  { kode: 'terverifikasi',  label: 'Terverifikasi',  warna: 'terverifikasi' },
];

export const TAHAP_PKS: StatusPo[] = [
  { kode: 'pks_terbit',         label: 'PKS terbit',         warna: 'pks-terbit' },
  { kode: 'pks_ditandatangani', label: 'PKS ditandatangani', warna: 'pks-ditandatangani' },
  { kode: 'aktif',              label: 'Layanan aktif',      warna: 'aktif' },
  { kode: 'selesai',            label: 'Selesai',            warna: 'selesai' },
];

/**
 * Ringkasan di menu PKS. 'terverifikasi' ikut tampil di sana karena PO-nya
 * memang terdaftar di halaman itu sebagai yang PKS-nya belum terbit; labelnya
 * mengikuti konteks menu, bukan diulang apa adanya dari Daftar PO.
 */
export const RINGKAS_PKS: StatusPo[] = [
  { kode: 'terverifikasi', label: 'Belum terbit', warna: 'terverifikasi' },
  ...TAHAP_PKS,
];

/**
 * Urutan maju tahapan, dipakai corong untuk menghitung "PERNAH mencapai tahap
 * ini", bukan "sedang di tahap ini".
 *
 * WAJIB memuat seluruh status maju. Sebelumnya `aktif` dan `selesai` tidak
 * tercantum, dan karena perbandingannya memakai indexOf, keduanya bernilai -1:
 * PO yang sudah berjalan terhitung di "PO dibuat" lalu lenyap dari semua langkah
 * sesudahnya. Belum terlihat karena belum ada yang memindahkan PO ke sana, tapi
 * corongnya akan salah diam-diam begitu checklist bulanan jadi.
 *
 * `ditolak` sengaja di luar: ia cabang buntu, bukan tahap maju, dan corong
 * mengeluarkannya lewat penyaring tersendiri.
 */
export const URUTAN_TAHAP = [
  'draf', 'menunggu_ttd', 'ditandatangani', 'verifikasi', 'terverifikasi',
  'pks_terbit', 'pks_ditandatangani', 'aktif', 'selesai',
];

/** Berapa PO yang PERNAH mencapai `tahap`, tidak termasuk yang ditolak. */
export function pernahSampai(daftar: { status: string }[], tahap: string) {
  const batas = URUTAN_TAHAP.indexOf(tahap);
  return daftar.filter((x) => x.status !== 'ditolak'
    && URUTAN_TAHAP.indexOf(x.status) >= batas).length;
}

export const KODE_TAHAP_PO = TAHAP_PO.map((s) => s.kode);
export const KODE_TAHAP_PKS = TAHAP_PKS.map((s) => s.kode);

/**
 * Status yang sudah melewati verifikasi. Menyaring hanya 'terverifikasi'
 * membuat PO menghilang dari daftarnya sendiri begitu statusnya naik — persis
 * yang pernah terjadi pada Antrean Verifikasi.
 */
export const SETELAH_VERIFIKASI = ['terverifikasi', ...KODE_TAHAP_PKS];

/**
 * Palet juring untuk kategori yang tidak punya warna status sendiri — sebaran
 * paket, jenjang, komponen. Memakai token status yang kontrasnya sudah diukur
 * lolos 3:1 di kedua tema, diurutkan agar juring bersebelahan tidak berdekatan
 * rona.
 *
 * Tinggal di sini, bukan di `lib/grafik.tsx`, karena modul itu bertanda
 * `'use client'`: nilai biasa yang diimpor komponen server dari modul klien
 * berubah jadi rujukan klien, dan `PALET[i]` diam-diam bernilai undefined di
 * server. Itulah yang membuat juring analitik keluar sebagai `w-undefined`
 * lalu hitam, sementara halaman beranda yang memakai TAHAP_PO baik-baik saja.
 */
export const PALET = [
  'verifikasi', 'menunggu-ttd', 'pks-terbit', 'aktif', 'terverifikasi',
  'ditolak', 'selesai', 'pks-ditandatangani', 'draf', 'ditandatangani',
];
