/**
 * Aturan komponen yang TIDAK memuat angka harga: siapa pesertanya (siswa atau guru),
 * batas minimal peserta, dan kapasitas per sesi.
 *
 * Dipisah dari `pricelist.ts` 11 Sep 2026 karena satu alasan: form PO berjalan di
 * peramban dan butuh aturan-aturan ini, sedangkan `pricelist.ts` memuat harga
 * Acquisition. Selama keduanya satu berkas, form PO menyeret seluruh pricelist ke
 * peramban — dan itu yang terjadi sejak form PO dibuat. Berkas ini boleh sampai ke
 * klien; `pricelist.ts` tidak (dijaga `uji/batas-harga.test.mjs`).
 *
 * MIN_PESERTA, KAPASITAS_SESI dan ID_GURU ikut cap kesetiaan dengan
 * `skolla-pricing-calculator` (`uji/pricelist.test.mjs`). Aturan dua salinannya tidak
 * berubah: yang berubah di sini wajib diubah juga di kalkulator lama.
 *
 * KAPASITAS_SESI dulu tidak ikut cap karena kalkulator lama memang tidak menegakkannya.
 * Sejak 22 Sep 2026 ia ikut menegakkannya, jadi aturan ini masuk cap.
 */

/** Komponen yang dihitung dari jumlah guru, bukan siswa. */
export const ID_GURU = ['guruOff', 'guruOn'];

/** Batas minimal peserta per komponen, dari keterangan pricelist. */
export const MIN_PESERTA: Record<string, { n: number; per: 'siswa' | 'guru' }> = {
  live:    { n: 30, per: 'siswa' },
  pmOn:    { n: 30, per: 'siswa' },
  pendam:  { n: 30, per: 'siswa' },
  psiOn:   { n: 10, per: 'siswa' },
  psiOff:  { n: 10, per: 'siswa' },
  guruOff: { n: 10, per: 'guru' },
  guruOn:  { n: 10, per: 'guru' },
};

/**
 * Kapasitas maksimal per sesi. Sesi minimal = peserta / kapasitas, dibulatkan ke atas.
 * Tanpa aturan ini, satu sesi untuk 900 siswa lolos — mustahil dilaksanakan
 * sekaligus salah harga.
 */
export const KAPASITAS_SESI: Record<string, { n: number; per: 'siswa' | 'guru' }> = {
  psiOff:  { n: 30, per: 'siswa' },
  psiOn:   { n: 30, per: 'siswa' },
  guruOff: { n: 30, per: 'guru' },
  guruOn:  { n: 30, per: 'guru' },
};
