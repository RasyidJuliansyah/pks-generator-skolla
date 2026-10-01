/**
 * Ekor nomor perjanjian PKS: "/EXTSKOLLA/PKS/<bulan romawi>/<tahun>".
 *
 * Angka urutnya sengaja tidak dihasilkan sistem. Penomoran dipakai bersama
 * banyak jenis dokumen di luar sistem ini, jadi urutannya tidak bisa ditentukan
 * dari sini tanpa berisiko bentrok dengan dokumen lain yang memakai deret sama.
 */
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function ekorNomor(bulan: number, tahun: number): string {
  const r = ROMAWI[Math.min(12, Math.max(1, bulan)) - 1];
  return `/EXTSKOLLA/PKS/${r}/${tahun}`;
}
