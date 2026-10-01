/**
 * Langkah wizard Form PO (catatan/11-spesifikasi-wizard-po.md). Murni: dipakai
 * klien, diuji uji/langkah-po.test.mjs.
 *
 * Urutan diputuskan 14 Sep 2026: Paket & harga SEBELUM Rombel, seperti form lama.
 */
export type KodeLangkah = 'cara' | 'sekolah' | 'paket' | 'rombel' | 'termin' | 'penanda' | 'tinjau';

/** Satu halangan simpan atau cetak, berikut langkah tempat ia diperbaiki. */
export type Halangan = { langkah: KodeLangkah; pesan: string };

export const LANGKAH: { kode: KodeLangkah; judul: string }[] = [
  { kode: 'cara', judul: 'Cara membuat' },
  { kode: 'sekolah', judul: 'Sekolah' },
  { kode: 'paket', judul: 'Paket & harga' },
  { kode: 'rombel', judul: 'Rombel' },
  { kode: 'termin', judul: 'Termin & masa aktif' },
  { kode: 'penanda', judul: 'Penanda tangan & catatan' },
  { kode: 'tinjau', judul: 'Tinjau' },
];

/** "Cara membuat" hanya saat membuat PO baru: jalur PO yang sudah ada dibekukan basis data. */
export const langkahTampil = (adaAwal: boolean) =>
  LANGKAH.filter((l) => !adaAwal || l.kode !== 'cara');

/** PO baru mulai dari awal; draf yang dibuka lagi langsung ke Tinjau. */
export const langkahAwal = (adaAwal: boolean): KodeLangkah => (adaAwal ? 'tinjau' : 'cara');

export type StatusLangkah = 'lengkap' | 'halangan' | 'belum';

/**
 * Tiga status sesuai catatan/11: belum dibuka, ada halangan, lengkap. Langkah yang belum
 * dibuka tidak dimerahkan meski halangannya sudah ada: PO baru hampir selalu punya
 * halangan di langkah depan, dan semuanya tetap tercantum di Tinjau berikut tautannya.
 */
export function statusLangkah(
  kode: KodeLangkah, halangan: Halangan[], dikunjungi: Set<KodeLangkah>,
): StatusLangkah {
  if (!dikunjungi.has(kode)) return 'belum';
  return halangan.some((h) => h.langkah === kode) ? 'halangan' : 'lengkap';
}

/** Halaman scan PO unggahan yang dibuka di samping langkah; null = scan utuh atau tanpa scan. */
export function halamanScan(kode: KodeLangkah): number | null {
  if (kode === 'penanda') return 2;
  if (kode === 'tinjau' || kode === 'cara') return null;
  return 1;
}
