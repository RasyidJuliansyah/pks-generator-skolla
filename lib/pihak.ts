/**
 * Pihak penanda tangan Form Pre Order, dan SATU-SATUNYA sumber daftar serta labelnya di
 * aplikasi. Cerminnya di basis data: private.pihak_wajib(skema) (catatan/23).
 *
 * Head of Sales SENGAJA tetap bernilai `sales_manager`: kotaknya sama, cuma namanya
 * berganti. Tidak ada baris tanda_tangan atau berkas storage yang perlu dipindah. PO
 * skema 3 tetap berlabel "Sales Manager" supaya dokumen yang sudah diteken tidak berubah
 * isi saat dirender ulang.
 */
export type Pihak = 'kepala_sekolah' | 'partnership_manager' | 'regional_head' | 'sales_manager';
export type SkemaTtd = 3 | 4;

export const SEMUA_PIHAK: Pihak[] = ['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager'];

export const pihakUntuk = (skema: SkemaTtd): Pihak[] =>
  skema === 4 ? SEMUA_PIHAK : SEMUA_PIHAK.filter((p) => p !== 'regional_head');

export function labelPihak(p: Pihak, skema: SkemaTtd): string {
  switch (p) {
    case 'kepala_sekolah': return 'Kepala Sekolah';
    case 'partnership_manager': return 'Partnership Manager';
    case 'regional_head': return 'Regional Head Division';
    case 'sales_manager': return skema === 4 ? 'Head of Sales' : 'Sales Manager';
  }
}

/** Nilai kolom po.skema_ttd dari baris mana pun; yang bukan 4 persis terbaca 3. */
export const skemaDari = (v: unknown): SkemaTtd => (v === 4 ? 4 : 3);
