/**
 * Daftar periksa verifikasi, disalin dari "Dokumen Checklist Verifikasi Kesiapan
 * Proyek/Kerja Sama" milik tim Operasional.
 *
 * Bagian A, B, dan C berasal dari dokumen aslinya. Bagian D (Finance) dan E
 * (Service Account) ditambahkan karena dokumen itu tidak punya satu pun item
 * keuangan maupun kesiapan layanan — padahal keduanya ikut memberi lampu hijau.
 *
 * Isinya di kode, bukan basis data: ia bagian dari definisi proses, dan
 * perubahannya harus lewat tinjauan seperti perubahan aturan lain.
 */

export type Fungsi = 'education' | 'tech_ops' | 'finance' | 'service_account';

export const URUT_FUNGSI: Fungsi[] = ['education', 'tech_ops', 'finance', 'service_account'];

export const LABEL_FUNGSI: Record<Fungsi, string> = {
  education: 'Education',
  tech_ops: 'Tech Ops',
  finance: 'Finance',
  service_account: 'Service Account',
};

export type ItemPeriksa = { kode: string; teks: string; opsional?: boolean };

export const CHECKLIST: Record<Fungsi, { bagian: string; item: ItemPeriksa[] }> = {
  education: {
    bagian: 'A. Kesiapan Akademik & Konten',
    item: [
      { kode: 'a1', teks: 'Kurikulum dan learning objective jelas' },
      { kode: 'a2', teks: 'Materi sesuai level target siswa' },
      { kode: 'a3', teks: 'Konten telah melalui QC dan approval' },
    ],
  },
  tech_ops: {
    bagian: 'B. Kesiapan Produk & Teknis',
    item: [
      { kode: 'b1', teks: 'Fitur utama berfungsi tanpa bug kritikal' },
      { kode: 'b2', teks: 'Severity bug ditentukan tepat dan konsisten' },
      { kode: 'b3', teks: 'Integrasi sistem berjalan normal' },
      { kode: 'b4', teks: 'Permintaan penambahan produk siap dilaksanakan', opsional: true },
    ],
  },
  finance: {
    bagian: 'D. Kesesuaian Harga & Komersial',
    item: [
      { kode: 'd1', teks: 'Harga sesuai pricelist, atau deviasi sudah disetujui' },
      { kode: 'd2', teks: 'Termin pembayaran jelas dan totalnya sama dengan nilai PO' },
      { kode: 'd3', teks: 'Status pajak jelas: harga sudah termasuk pajak' },
      { kode: 'd4', teks: 'Sponsorship atau hibah sudah punya dokumen pendukung', opsional: true },
    ],
  },
  service_account: {
    bagian: 'C. Kesiapan Operasional & E. Kesiapan Layanan',
    item: [
      { kode: 'c2', teks: 'Tim support siap: jadwal dan tools' },
      { kode: 'e1', teks: 'Daftar layanan sesuai PO' },
      { kode: 'e2', teks: 'Jadwal dan kapasitas tersedia; batas minimal peserta terpenuhi' },
      { kode: 'e3', teks: 'PIC layanan sudah ditetapkan' },
      { kode: 'e4', teks: 'Checklist bulanan siap dibuat' },
    ],
  },
};

/**
 * Wilayah tiap fungsi. Dipakai untuk reset selektif: bila PO direvisi dan bidang
 * yang berubah menyentuh wilayah sebuah fungsi, persetujuannya dibatalkan supaya
 * diperiksa ulang. Tanpa ini, satu koreksi kecil memutar ulang empat persetujuan.
 */
//
// `jenjang` masuk tiga fungsi karena materi dan layanan disusun per jenjang (a2).
// `sumber_dana` dan `sponsorship` (catatan sponsorship) masuk Finance karena d4
// menuntut dokumen pendukung sponsorship/hibah. Rombel sengaja tidak: perubahan
// jumlah siswa sudah tertangkap.
//
// `kelompok` (susunan kelompok PO: nama, harga, kelas mana di kelompok mana) masuk KEEMPAT
// fungsi: memindahkan kelas 12 ke kelompok lain mengubah harga yang ditagih (Finance)
// sekaligus siapa memakai layanan apa (Education, Tech Ops, Service Account).
//
// `permintaan_tambahan` masuk Tech Ops karena b4 (permintaan penambahan produk) milik Tech Ops.
const WILAYAH: Record<Fungsi, string[]> = {
  finance: ['harga_siswa', 'harga_guru', 'grand_total', 'termin', 'sumber_dana', 'sponsorship', 'kelompok'],
  education: ['komponen', 'jumlah_siswa', 'jumlah_guru', 'sekolah', 'kepala_sekolah', 'jenjang', 'kelompok'],
  tech_ops: ['komponen', 'jumlah_siswa', 'jumlah_guru', 'sekolah', 'kepala_sekolah', 'jenjang', 'kelompok',
    'permintaan_tambahan'],
  service_account: [
    'komponen', 'jumlah_siswa', 'jumlah_guru', 'masa_mulai', 'masa_selesai',
    'sekolah', 'kepala_sekolah', 'jenjang', 'kelompok',
  ],
};

/** Fungsi mana yang persetujuannya jadi basi bila bidang-bidang ini berubah. */
export function fungsiTerdampak(berubah: string[]): Fungsi[] {
  return URUT_FUNGSI.filter((f) => WILAYAH[f].some((b) => berubah.includes(b)));
}

/**
 * Apakah satu isian teks berubah. `undefined` berarti tidak dikirim — supabase-js
 * membuang kuncinya, jadi kolomnya memang tidak berubah. Kosong, null, dan spasi di
 * tepi dianggap sama: isian yang diisi lalu dikosongkan terkirim sebagai '' padahal
 * yang tersimpan null, dan spasi tambahan bukan perubahan isi.
 */
export function isianBerubah(lama: unknown, baru: unknown): boolean {
  if (baru === undefined) return false;
  const rata = (v: unknown) => (v == null ? '' : String(v).trim());
  return rata(lama) !== rata(baru);
}

/**
 * Tanda sebuah daftar baris (rombel, catatan) untuk dibandingkan apa adanya: urutan
 * tidak berpengaruh, null sama dengan kosong, spasi di tepi dibuang. Baris ganda
 * tetap terhitung — dua baris yang sama bukan satu.
 */
export function tandaDaftar(baris: unknown[][]): string {
  const rata = (v: unknown) => (v == null ? '' : String(v).trim());
  return JSON.stringify(baris.map((b) => JSON.stringify(b.map(rata))).sort());
}
